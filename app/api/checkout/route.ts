import { NextResponse } from "next/server";
import Stripe from "stripe";

const CATALOG = {
  mulligan: { name: "Mulligan", description: "One re-hit for your team", unitAmount: 1000 },
  string: { name: "String extender", description: "One sealed 6–24 inch digital envelope", unitAmount: 2000 },
  raffle: { name: "50/50 raffle ticket", description: "Half the pot goes to the winner", unitAmount: 2000 },
} as const;

type ProductId = keyof typeof CATALOG;

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Payments are not connected yet." }, { status: 503 });
  }

  const payload = await request.json() as {
    teamId?: string;
    buyerId?: string;
    lines?: Array<{ productId?: string; qty?: number }>;
  };
  const lines = (payload.lines ?? []).filter((line): line is { productId: ProductId; qty: number } =>
    typeof line.productId === "string" && line.productId in CATALOG
      && Number.isInteger(line.qty) && Number(line.qty) > 0 && Number(line.qty) <= 20,
  );
  if (!payload.teamId || !payload.buyerId || lines.length === 0) {
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
