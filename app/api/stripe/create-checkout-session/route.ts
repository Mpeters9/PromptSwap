import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type CreateSessionBody = {
  prompt_id?: string;
  title?: string;
  price?: number;
  user_id?: string;
};

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

    const { prompt_id, title, price, user_id } = (await req.json()) as CreateSessionBody;
    if (!prompt_id || !title || price === undefined || price === null || !user_id) {
      return NextResponse.json(
        { error: 'prompt_id, title, price, and user_id are required' },
        { status: 400 },
      );
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ error: 'Price must be a positive number.' }, { status: 400 });
    }

    // Prevent duplicate purchases
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('buyer_id', user_id)
      .eq('prompt_id', prompt_id)
      .maybeSingle();
    if (existingError) {
      console.error('Checkout existing purchase lookup failed', existingError);
      return NextResponse.json({ error: 'purchase_check_failed' }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json({ error: 'already_owned' }, { status: 400 });
    }

    // Ensure price is in cents; if a non-integer is provided, treat it as dollars.
    const priceInCents = Number.isInteger(numericPrice)
      ? numericPrice
      : Math.round(numericPrice * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: title },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/checkout/success?prompt_id=${encodeURIComponent(prompt_id)}`,
      cancel_url: `${siteUrl}/marketplace/${encodeURIComponent(prompt_id)}`,
      metadata: { prompt_id, user_id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session failed', err);
    return NextResponse.json({ error: err?.message || 'Checkout session failed' }, { status: 500 });
  }
}
