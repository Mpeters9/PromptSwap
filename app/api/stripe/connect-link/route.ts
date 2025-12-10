import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and service role key must be set for Stripe connect-link.');
}

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing. Set it in .env.local.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' });

function extractToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.replace(/^[Bb]earer\s+/, '').trim();
  }

  if (!projectRef) return null;
  const cookieName = `sb-${projectRef}-auth-token`;
  const raw =
    req.cookies.get(cookieName)?.value ?? req.cookies.get('supabase-auth-token')?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return (parsed[0] as string) ?? null;
    if (parsed?.access_token) return parsed.access_token as string;
    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token as string;
  } catch (err) {
    console.error('Failed to parse Supabase auth cookie', err);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req);
    if (!token) {
      console.error('Stripe connect-link: missing auth token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: session, error: sessionError } = await supabaseAdmin.auth.getUser(token);
    if (sessionError || !session?.user) {
      console.error('Stripe connect-link: session lookup failed', sessionError);
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, connected_account_id')
      .eq('id', userId)
      .single();
    if (profileError) {
      console.error('Stripe connect-link: profile fetch failed', profileError);
      return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 });
    }

    let accountId = profile?.stripe_account_id;
    if (!accountId && profile?.connected_account_id) {
      accountId = profile.connected_account_id;
    }

    if (!accountId) {
      const account = await stripe.accounts.create({ type: 'standard', metadata: { userId } });
      accountId = account.id;
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', userId);
      if (updateError) {
        console.error('Stripe connect-link: failed to store account id', updateError);
        return NextResponse.json({ error: 'Failed to save account' }, { status: 500 });
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/dashboard/connect-stripe`,
      return_url: `${siteUrl}/dashboard/connect-stripe`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error('Stripe connect-link: unexpected error', err);
    return NextResponse.json({ error: err?.message || 'Connect link failed' }, { status: 500 });
  }
}
