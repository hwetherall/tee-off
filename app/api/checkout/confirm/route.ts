import { NextResponse } from "next/server";
import Stripe from "stripe";
import { checkoutTotalCents, parseCheckoutLines, ticketPrefix } from "@/src/lib/shop";

export async function GET(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!secret || !sessionId) {
    return NextResponse.json({ error: "Payment confirmation is unavailable." }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment has not completed." }, { status: 409 });
  }

  const lines = parseCheckoutLines(session.metadata?.lines);
  if (
    !lines
    || !session.metadata?.team_id
    || !session.metadata?.buyer_id
    || session.currency !== "usd"
    || session.amount_total !== checkoutTotalCents(lines)
  ) {
    return NextResponse.json({ error: "Payment details are invalid." }, { status: 422 });
  }
  const raffleQty = lines.find((line) => line.productId === "raffle")?.qty ?? 0;
  const stringQty = lines.find((line) => line.productId === "string")?.qty ?? 0;
  const prefix = ticketPrefix(session.id);

  return NextResponse.json({
    order: {
      id: `order-${session.id}`,
      teamId: session.metadata?.team_id,
      buyerId: session.metadata?.buyer_id,
      lines,
      amount: (session.amount_total ?? 0) / 100,
      channel: "self",
      paymentRef: session.id,
      createdAt: new Date(session.created * 1000).toISOString(),
      synced: false,
    },
    envelopeIds: Array.from({ length: stringQty }, (_, index) => `envelope-${session.id}-${index + 1}`),
    tickets: Array.from({ length: raffleQty }, (_, index) => ({
      id: `ticket-${session.id}-${index + 1}`,
      number: `DB-${prefix}-${String(index + 1).padStart(2, "0")}`,
    })),
  });
}
