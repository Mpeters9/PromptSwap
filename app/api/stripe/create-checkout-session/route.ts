import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type Prompt = { id: string; title?: string | null; price?: number | null };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set.');
}

const supabase =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' });

async function getPrompt(promptId: string): Promise<Prompt | null> {
  if (!supabase) {
    // Mocked prompt if Supabase is not configured.
    return { id: promptId, title: `Prompt ${promptId}`, price: 5 };
  }
  const { data, error } = await supabase
    .from('prompts')
    .select('id, title, price')
    .eq('id', promptId)
    .single();
  if (error) return null;
  return data as Prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { promptId } = (await req.json()) as { promptId?: string };
    if (!promptId) {
      return NextResponse.json({ error: 'promptId is required' }, { status: 400 });
    }

    const prompt = await getPrompt(promptId);
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    const price = prompt.price ?? 5; // fallback mock price in USD
    if (Number(price) <= 0) {
      return NextResponse.json({ error: 'Prompt price is invalid' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: prompt.title ?? `Prompt ${prompt.id}`,
            },
            unit_amount: Math.round(Number(price) * 100), // cents
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
      metadata: {
        promptId: prompt.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session failed', err);
    return NextResponse.json({ error: 'Checkout session failed' }, { status: 500 });
  }
}
