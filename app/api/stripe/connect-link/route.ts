import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and service role key must be set for Stripe connect-link.');
}

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing. Set it in .env.local.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18' });

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // Extract user from cookie/session: using Supabase auth helpers is recommended.
  // For MVP we assume the client has a Supabase session and passes access_token as Bearer.
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate the session and get user id
  const { data: session, error: sessionError } = await supabaseAdmin.auth.getUser(token);
  if (sessionError || !session?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const userId = session.user.id;

  // Check if user already has a Stripe account
  const { data: profile } = await supabaseAdmin.from('profiles').select('stripe_account_id').eq('id', userId).single();
  let accountId = profile?.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'standard', metadata: { userId } });
    accountId = account.id;
    await supabaseAdmin.from('profiles').update({ stripe_account_id: accountId }).eq('id', userId);
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${siteUrl}/dashboard/connect-stripe`,
    return_url: `${siteUrl}/dashboard/connect-stripe`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
