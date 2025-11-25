import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set.');
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' });

type CreateSessionBody = {
  prompt_id?: string;
  title?: string;
  price?: number;
  user_id?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { prompt_id, title, price, user_id } = (await req.json()) as CreateSessionBody;
    console.log('Create checkout payload', { prompt_id, title, price, user_id });

    if (!prompt_id || !title || price === undefined || price === null) {
      return NextResponse.json(
        { error: 'prompt_id, title, and price are required' },
        { status: 400 },
      );
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ error: 'Price must be a positive number.' }, { status: 400 });
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

    console.log('Stripe session created', { id: session.id, url: session.url });
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session failed', err);
    return NextResponse.json({ error: err?.message || 'Checkout session failed' }, { status: 500 });
  }
}
