import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-04-10" });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;

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
