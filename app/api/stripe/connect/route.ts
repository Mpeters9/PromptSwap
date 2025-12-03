import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set.');
}
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase service credentials are required.');
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type ConnectBody = { user_id?: string };
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

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
    console.error('Stripe connect token parse error', err);
  }
  return null;
}

/**
 * POST /api/stripe/connect
 * Generates a Stripe OAuth onboarding link for the given user_id.
 */
export async function POST(req: NextRequest) {
  try {
    if (!clientId) {
      return NextResponse.json({ error: 'Stripe client ID not configured.' }, { status: 400 });
    }

    const { user_id } = ((await req.json().catch(() => ({}))) as ConnectBody) ?? {};
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || userData?.user?.id !== user_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const redirectUri = `${siteUrl}/api/stripe/connect`;
    const url = new URL('https://connect.stripe.com/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'read_write');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', user_id);

    return NextResponse.json({ url: url.toString() });
  } catch (err: any) {
    console.error('Stripe connect link failed', err);
    return NextResponse.json({ error: 'Failed to create connect link' }, { status: 500 });
  }
}

/**
 * GET /api/stripe/connect
 * Handles the OAuth callback from Stripe, exchanges the code for an account_id,
 * and stores it on the user's profile in Supabase.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state'); // we set this to user_id
  const errorParam = req.nextUrl.searchParams.get('error');
  const queryUserId = req.nextUrl.searchParams.get('user_id');

  // If no code yet, generate an onboarding link and redirect the user to Stripe.
  if (!code) {
    if (!clientId) {
      return NextResponse.json({ error: 'Stripe client ID not configured.' }, { status: 400 });
    }
    if (!queryUserId) {
      return NextResponse.json({ error: 'user_id is required to start onboarding.' }, { status: 400 });
    }

    const redirectUri = `${siteUrl}/api/stripe/connect`;
    const url = new URL('https://connect.stripe.com/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'read_write');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', queryUserId);

    return NextResponse.redirect(url.toString());
  }

  if (errorParam) {
    console.error('Stripe OAuth returned error', errorParam);
    return NextResponse.json({ error: errorParam }, { status: 400 });
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    // Optionally ensure caller is authenticated (protect against CSRF reuse).
    const token = extractToken(req);
    if (token) {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      if (userData?.user?.id && userData.user.id !== state) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    const tokenResponse = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    const accountId = tokenResponse.stripe_user_id;
    if (!accountId) {
      return NextResponse.json({ error: 'No account_id returned from Stripe' }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', state);

    if (updateError) {
      console.error('Failed to store Stripe account ID', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, account_id: accountId });
  } catch (err: any) {
    console.error('Stripe OAuth exchange failed', err);
    return NextResponse.json({ error: err?.message || 'Stripe OAuth failed' }, { status: 500 });
  }
}
