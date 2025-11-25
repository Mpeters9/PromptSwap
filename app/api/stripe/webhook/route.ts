import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Load required secrets from the environment.
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY is required');
if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is required');
if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase service credentials are required');

const stripe = new Stripe(stripeSecret, { apiVersion: '2024-11-15' });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Disable static optimization; Stripe needs the raw request body for signature verification.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 1) Grab the raw body for signature verification (protects against replay/tampering).
  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  if (!signature) {
    console.error('Missing Stripe signature header');
    return new Response('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err?.message || err);
    return new Response(`Webhook Error: ${err?.message || 'Invalid signature'}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string | null;
      const promptId = (session.metadata?.prompt_id as string | undefined) ?? null;
      const userId = (session.metadata?.user_id as string | undefined) ?? null;

      console.log('Checkout session completed', {
        sessionId: session.id,
        customerId,
        promptId,
        userId,
      });

      if (!promptId || !userId) {
        console.warn('Missing prompt_id or user_id metadata; skipping purchase insert.');
      } else {
        // 2) Record the purchase in Supabase.
        const { error: insertError } = await supabaseAdmin
          .from('purchases')
          .insert({ user_id: userId, prompt_id: promptId, created_at: new Date().toISOString() });

        if (insertError) {
          // Do not fail the webhook for downstream retries; just log.
          console.error('Failed to insert purchase', insertError);
        }
      }

      // Optional: send confirmation email here using Supabase or another service.
    } else {
      console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('Webhook processing error', err);
    return NextResponse.json({ error: err?.message || 'Webhook processing failed' }, { status: 500 });
  }
}
