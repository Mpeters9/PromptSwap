import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-04-10" });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  const { promptId } = await req.json();

  if (!promptId)
    return NextResponse.json({ error: "Missing promptId" }, { status: 400 });

  const { data: prompt } = await supabaseAdmin
    .from("prompts")
    .select("id, price, user_id")
    .eq("id", promptId)
    .single();

  if (!prompt)
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

  // Get seller account metadata
  const { data: { user: seller } } = await supabaseAdmin.auth.admin.getUserById(prompt.user_id);

  const sellerStripeId = seller?.user_metadata?.stripe_account_id;

  if (!sellerStripeId)
    return NextResponse.json({ error: "Seller not onboarded" }, { status: 400 });

  // Create payment intent → sends funds to seller's Stripe account
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(prompt.price * 100),
    currency: "usd",
    application_fee_amount: Math.round(prompt.price * 100 * 0.10), // 10% marketplace fee
    transfer_data: {
      destination: sellerStripeId,
    },
    metadata: {
      promptId,
      sellerId: prompt.user_id,
    },
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
  });
}
