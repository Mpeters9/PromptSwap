import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

type GenericSupabaseClient = SupabaseClient<any, any, any, any, any>;

function getSupabaseAdmin(): GenericSupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey) as GenericSupabaseClient;
}

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return null;
  }
  return new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' });
}

function getToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '').trim();
}

async function getUserId(req: NextRequest, supabase: GenericSupabaseClient) {
  const token = getToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server misconfigured: Supabase URL and service role key are required.' },
      { status: 500 },
    );
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: 'Server misconfigured: STRIPE_SECRET_KEY is required.' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${siteUrl}/dashboard?stripe=error`);
  }
  if (!code) {
    return NextResponse.redirect(`${siteUrl}/dashboard?stripe=missing_code`);
  }

  const userId = await getUserId(req, supabase);
  if (!userId) {
    return NextResponse.redirect(`${siteUrl}/auth/sign-in?redirect=/dashboard`);
  }

  try {
    const tokenResponse = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    const connectedAccountId = tokenResponse.stripe_user_id;

    if (connectedAccountId) {
      await supabase.from('profiles').update({ stripe_account_id: connectedAccountId }).eq('id', userId);
    }

    return NextResponse.redirect(`${siteUrl}/dashboard?stripe=connected`);
  } catch (err) {
    console.error('Stripe OAuth error', err);
    return NextResponse.redirect(`${siteUrl}/dashboard?stripe=oauth_failed`);
  }
}
