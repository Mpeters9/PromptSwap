import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { promptId } = await req.json();

  if (!promptId)
    return NextResponse.json({ error: "Missing promptId" }, { status: 400 });

  const supabase = createRouteHandlerClient({ cookies });

  const { data: prompt } = await supabase
    .from("prompts")
    .select("id, price, creator_id")
    .eq("id", promptId)
    .single();

  if (!prompt)
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

  // Get seller account metadata
  const { data: { user: seller } } = await supabase.auth.admin.getUserById(prompt.creator_id);

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
      sellerId: prompt.creator_id,
    },
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
  });
}
