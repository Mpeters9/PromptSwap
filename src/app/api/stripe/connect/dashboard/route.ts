import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const accountId = user.user_metadata?.stripe_account_id;

  if (!accountId)
    return NextResponse.json({ error: "Account not created" }, { status: 400 });

  const link = await stripe.accounts.createLoginLink(accountId);

  return NextResponse.json({ url: link.url });
}
