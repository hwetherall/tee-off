import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { checkoutTotalCents, parseCheckoutLines, ticketPrefix } from "@/src/lib/shop";

export const runtime = "nodejs";

function serverConfig() {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !supabaseSecret) return null;
  return { stripeSecret, webhookSecret, supabaseUrl, supabaseSecret };
}

function serverSupabase(url: string, secret: string) {
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function fulfillCheckout(
  stripe: Stripe,
  supabase: ReturnType<typeof serverSupabase>,
  eventSession: Stripe.Checkout.Session,
) {
  const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
    expand: ["line_items"],
  });

  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return false;
  }

  const teamId = session.metadata?.team_id;
  const buyerId = session.metadata?.buyer_id;
  const lines = parseCheckoutLines(session.metadata?.lines);
  if (!teamId || !buyerId || !lines || session.currency !== "usd" || session.amount_total === null) {
    throw new Error("Checkout Session metadata is invalid.");
  }

  const expectedTotal = checkoutTotalCents(lines);
  const stripeLineTotal = session.line_items?.data.reduce((total, line) => total + line.amount_total, 0);
  if (session.amount_total !== expectedTotal || stripeLineTotal !== expectedTotal) {
    throw new Error("Checkout Session total does not match the server catalog.");
  }

  const orderId = `order-${session.id}`;
  const mulliganQty = lines.find((line) => line.productId === "mulligan")?.qty ?? 0;
  const stringQty = lines.find((line) => line.productId === "string")?.qty ?? 0;
  const splitsQty = lines.find((line) => line.productId === "splits")?.qty ?? 0;
  const prefix = ticketPrefix(session.id);

  const { data, error } = await supabase.rpc("fulfill_stripe_checkout", {
    p_amount: session.amount_total / 100,
    p_buyer_id: buyerId,
    p_created_at: new Date(session.created * 1000).toISOString(),
    p_envelope_ids: Array.from({ length: stringQty }, (_, index) => `envelope-${session.id}-${index + 1}`),
    p_lines: lines,
    p_mulligan_qty: mulliganQty,
    p_order_id: orderId,
    p_payment_ref: session.id,
    p_team_id: teamId,
    p_tickets: Array.from({ length: splitsQty }, (_, index) => ({
      id: `ticket-${session.id}-${index + 1}`,
      number: `DB-${prefix}-${String(index + 1).padStart(2, "0")}`,
    })),
  });
  if (error) throw error;

  return data === true;
}

export async function POST(request: Request) {
  const config = serverConfig();
  if (!config) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const body = await request.text();
  const stripe = new Stripe(config.stripeSecret);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, config.webhookSecret);
  } catch (error) {
    console.warn(
      "Stripe webhook signature verification failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const fulfilled = await fulfillCheckout(
      stripe,
      serverSupabase(config.supabaseUrl, config.supabaseSecret),
      event.data.object,
    );
    return NextResponse.json({ received: true, fulfilled });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error && typeof error.message === "string"
          ? error.message
          : "Unknown error";
    console.error(`Stripe fulfillment failed for event ${event.id}:`, message);
    return NextResponse.json({ error: "Fulfillment failed." }, { status: 500 });
  }
}
