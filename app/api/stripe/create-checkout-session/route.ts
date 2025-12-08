import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Stripe in test mode (use your test secret key in .env.local)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Supabase service client (we may use this later to log purchases, etc.)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY!,
);

// Payload shape expected from components/BuyButton.tsx
type CheckoutRequestBody = {
  prompt_id: string;
  title: string;
  price: number;   // in cents
  user_id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutRequestBody;

    const promptId = body?.prompt_id;
    const title = body?.title;
    const priceInCents = Number(body?.price);

    if (!promptId || !title || !Number.isFinite(priceInCents) || priceInCents <= 0) {
      console.error("[stripe] Invalid checkout payload", { body });
      return NextResponse.json(
        { error: "Missing or invalid prompt_id, title, or price" },
        { status: 400 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    // Create a one-time payment session using inline price_data
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: priceInCents,
            product_data: {
              name: title,
              metadata: {
                prompt_id: promptId,
              },
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel`,
      metadata: {
        prompt_id: promptId,
        user_id: body.user_id ?? "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    const message =
      err?.message ??
      "Stripe checkout error. Please check STRIPE_SECRET_KEY and your test mode configuration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
