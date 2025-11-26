import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let stripeAccountId = user.user_metadata?.stripe_account_id;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email!,
      capabilities: { transfers: { requested: true } }
    });

    stripeAccountId = account.id;

    await supabase.auth.updateUser({
      data: { stripe_account_id: stripeAccountId }
    });
  }

  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL}/seller`,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/seller`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
