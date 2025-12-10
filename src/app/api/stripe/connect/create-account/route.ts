import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-04-10" });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value ?? null;
  if (!accessToken) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  const user = userData?.user;

  if (userError || !user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let stripeAccountId = user.user_metadata?.stripe_account_id;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email!,
      capabilities: { transfers: { requested: true } }
    });

    stripeAccountId = account.id;

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { stripe_account_id: stripeAccountId }
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
