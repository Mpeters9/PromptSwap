import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-11-15' });

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Checkout session completed:', session.id);

      // Update your DB
      await supabase
        .from('prompt_sales')
        .update({
          status: 'completed',
          stripe_txn_id: session.id,
          buyer_id: (session.customer as string) || null,
        })
        .eq('stripe_txn_id', session.id);
      break;
    }

    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
