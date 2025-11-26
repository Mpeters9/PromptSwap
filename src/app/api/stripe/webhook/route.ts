import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret!);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY!
  );

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;

    const promptId = intent.metadata.promptId;
    const sellerId = intent.metadata.sellerId;
    const buyerId = intent.customer;

    await supabase.from("purchases").insert({
      prompt_id: promptId,
      seller_id: sellerId,
      buyer_id: buyerId,
      amount: intent.amount_received / 100
    });
  }

  return NextResponse.json({ received: true });
}
