import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set.');
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' });

export async function POST() {
  try {
    if (!clientId) {
      return NextResponse.json({ error: 'Stripe client ID not configured.' }, { status: 400 });
    }

    const redirectUri = `${siteUrl}/dashboard/connect-stripe`;
    const url = new URL('https://connect.stripe.com/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'read_write');
    url.searchParams.set('redirect_uri', redirectUri);

    return NextResponse.json({ url: url.toString() });
  } catch (err: any) {
    console.error('Stripe connect link failed', err);
    return NextResponse.json({ error: 'Failed to create connect link' }, { status: 500 });
  }
}
