import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase service credentials are required for payouts.');
}
if (!stripeSecret) {
  throw new Error('STRIPE_SECRET_KEY is required for payouts.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const stripe = new Stripe(stripeSecret, { apiVersion: '2024-11-15' });

type ProfileRow = {
  stripe_account_id?: string | null;
  connected_account_id?: string | null;
};

type PurchaseRow = { price: number | null };
type PayoutRow = { amount: number | null };

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
    console.error('Payout: failed to parse auth cookie', err);
  }
  return null;
}

function sumAmounts<T extends Record<string, any>>(rows: T[] | null | undefined, key: keyof T) {
  return (rows ?? []).reduce((acc, row) => acc + Number(row[key] ?? 0), 0);
}

const rateLimitWindowMs = 60_000;
const rateLimitMax = 5;
const payoutLimiter = new Map<string, { ts: number; count: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const current = payoutLimiter.get(key);
  if (!current || now - current.ts > rateLimitWindowMs) {
    payoutLimiter.set(key, { ts: now, count: 1 });
    return false;
  }
  if (current.count >= rateLimitMax) return true;
  current.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req);
    if (!token) {
      console.error('Payout: missing auth token');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const userId = userData?.user?.id ?? null;
    if (userError || !userId) {
      console.error('Payout: auth lookup failed', userError);
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (rateLimit(userId)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    let body: { amount?: number };
    try {
      body = (await req.json()) as { amount?: number };
    } catch {
      body = {};
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from<ProfileRow>('profiles')
      .select('stripe_account_id, connected_account_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Payout: profile fetch failed', profileError);
      return NextResponse.json({ error: 'profile_not_found' }, { status: 500 });
    }

    const accountId = profile?.connected_account_id ?? profile?.stripe_account_id ?? null;
    if (!accountId) {
      console.error('Payout: user missing Stripe account', { userId });
      return NextResponse.json({ error: 'missing_stripe_account' }, { status: 400 });
    }

    const { data: purchases, error: purchasesError } = await supabaseAdmin
      .from<PurchaseRow>('purchases')
      .select('price')
      .eq('seller_id', userId);
    if (purchasesError) {
      console.error('Payout: failed to load purchases', purchasesError);
      return NextResponse.json({ error: 'purchases_lookup_failed' }, { status: 500 });
    }

    const { data: paidOut, error: paidOutError } = await supabaseAdmin
      .from<PayoutRow>('payouts')
      .select('amount')
      .eq('seller_id', userId);
    if (paidOutError) {
      console.error('Payout: failed to load payouts', paidOutError);
      return NextResponse.json({ error: 'payouts_lookup_failed' }, { status: 500 });
    }

    const gross = sumAmounts(purchases, 'price');
    const alreadyPaid = sumAmounts(paidOut, 'amount');
    const available = Math.max(0, gross - alreadyPaid);

    const requested = Number(body.amount);
    const payoutAmount =
      Number.isFinite(requested) && requested > 0 ? Math.min(requested, available) : available;

    if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
      return NextResponse.json({ error: 'no_funds_available', available }, { status: 400 });
    }

    const amountInCents = Math.round(payoutAmount * 100);
    if (amountInCents <= 0) {
      return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    }

    let transfer: Stripe.Transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: 'usd',
        destination: accountId,
        metadata: { seller_id: userId, source: 'manual_payout' },
      });
    } catch (err: any) {
      console.error('Stripe transfer failed', err);
      return NextResponse.json({ error: 'stripe_transfer_failed', message: err?.message }, { status: 500 });
    }

    const { error: insertError } = await supabaseAdmin.from('payouts').insert({
      seller_id: userId,
      amount: payoutAmount,
      currency: 'usd',
      stripe_transfer_id: transfer.id,
      destination_account: accountId,
    });

    if (insertError) {
      console.error('Payout: failed to record payout', insertError);
      return NextResponse.json({ error: 'record_failed' }, { status: 500 });
    }

    const remaining = Math.max(0, available - payoutAmount);
    return NextResponse.json({
      ok: true,
      transfer_id: transfer.id,
      amount: payoutAmount,
      currency: 'usd',
      remaining,
    });
  } catch (err: any) {
    await logError(err, { scope: 'stripe_payout' });
    return NextResponse.json({ error: 'payout_failed' }, { status: 500 });
  }
}
