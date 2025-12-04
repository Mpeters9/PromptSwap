import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set.');
}
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase service role credentials are required.');
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-15' });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const rateLimitWindowMs = 60_000;
const rateLimitMax = 5;
const checkoutRateLimiter = new Map<string, { count: number; ts: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const current = checkoutRateLimiter.get(key);
  if (!current || now - current.ts > rateLimitWindowMs) {
    checkoutRateLimiter.set(key, { count: 1, ts: now });
    return false;
  }
  if (current.count >= rateLimitMax) return true;
  current.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
    if (rateLimit(ip)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const { prompt_id } = (await req.json()) as { prompt_id?: string };
    if (!prompt_id) {
      return NextResponse.json({ error: 'prompt_id is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const buyerId = sessionData?.session?.user?.id ?? null;
    if (sessionError || !buyerId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data: prompt, error: promptError } = await supabaseAdmin
      .from('prompts')
      .select('id, title, price, user_id, is_public')
      .eq('id', prompt_id)
      .maybeSingle();

    if (promptError) {
      console.error('Checkout prompt lookup failed', promptError);
      return NextResponse.json({ error: 'prompt_lookup_failed' }, { status: 500 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'prompt_not_found' }, { status: 404 });
    }
    if (!prompt.is_public && prompt.user_id !== buyerId) {
      return NextResponse.json({ error: 'prompt_not_available' }, { status: 403 });
    }

    const priceInCents = Math.round(Number(prompt.price ?? 0) * 100);
    if (!Number.isFinite(priceInCents) || priceInCents <= 0) {
      return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('prompt_id', prompt_id)
      .maybeSingle();
    if (existingError) {
      console.error('Checkout existing purchase lookup failed', existingError);
      return NextResponse.json({ error: 'purchase_check_failed' }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json({ error: 'already_owned' }, { status: 400 });
    }

    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('connected_account_id, stripe_account_id')
      .eq('id', prompt.user_id)
      .maybeSingle();

    const connectDestination =
      sellerProfile?.connected_account_id || sellerProfile?.stripe_account_id || undefined;

    const metadata = {
      prompt_id: prompt.id,
      buyer_id: buyerId,
      seller_id: prompt.user_id,
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: prompt.title },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/checkout/success?prompt_id=${encodeURIComponent(prompt.id)}`,
      cancel_url: `${siteUrl}/marketplace/${encodeURIComponent(prompt.id)}`,
      metadata,
      payment_intent_data: {
        metadata,
        ...(connectDestination
          ? {
              transfer_data: { destination: connectDestination },
            }
          : {}),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session failed', err);
    return NextResponse.json({ error: err?.message || 'Checkout session failed' }, { status: 500 });
  }
}
