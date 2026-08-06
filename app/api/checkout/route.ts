import { NextResponse } from "next/server";
import Stripe from "stripe";
import { CATALOG, validateCheckoutLines } from "@/src/lib/shop";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || process.env.NEXT_PUBLIC_SHOP_ENABLED !== "true") {
    return NextResponse.json({ error: "Payments are not connected yet." }, { status: 503 });
  }

  let payload: {
    teamId?: string;
    buyerId?: string;
    lines?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "The basket is not valid." }, { status: 400 });
  }

  const lines = validateCheckoutLines(payload.lines);
  if (!payload.teamId || !payload.buyerId || !lines) {
    return NextResponse.json({ error: "The basket is not valid." }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_creation: "always",
    line_items: lines.map((line) => ({
      quantity: line.qty,
      price_data: {
        currency: "usd",
        unit_amount: CATALOG[line.productId].unitAmount,
        product_data: {
          name: CATALOG[line.productId].name,
          description: CATALOG[line.productId].description,
        },
      },
    })),
    metadata: {
      team_id: payload.teamId,
      buyer_id: payload.buyerId,
      lines: JSON.stringify(lines),
    },
    success_url: `${origin}/?shop=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?shop=cancelled`,
    custom_text: {
      submit: { message: "Items are added to your team after payment." },
    },
  });

  return NextResponse.json({ url: session.url });
}
