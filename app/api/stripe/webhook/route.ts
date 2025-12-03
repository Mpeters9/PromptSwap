import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

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

type PromptRow = {
  id: string;
  user_id: string | null;
  price: number | null;
  prompt_text?: string | null;
};

type ProfileRow = {
  id?: string;
  credits?: number | null;
  stripe_account_id?: string | null;
  connected_account_id?: string | null;
};

const centsToDollars = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Number((value / 100).toFixed(2));

const readMetadata = (metadata: Stripe.Metadata | null | undefined, keys: string[]) => {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (value) return value;
  }
  return null;
};

async function eventAlreadyProcessed(eventId: string) {
  const { data, error } = await supabaseAdmin
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to check stripe_events');
  }

  return Boolean(data);
}

async function markEventProcessed(event: Stripe.Event) {
  const payload = {
    event_id: event.id,
    type: event.type,
    created_at: event.created ? new Date(event.created * 1000).toISOString() : new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from('stripe_events').insert(payload);
  if (error && error.code !== '23505') {
    console.error('Failed to record stripe event', error);
  }
}

async function fetchPrompt(promptId: string) {
  const { data, error } = await supabaseAdmin
    .from<PromptRow>('prompts')
    .select('id, user_id, price, prompt_text')
    .eq('id', promptId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load prompt');
  }

  return data ?? null;
}

async function ensurePurchase({
  buyerId,
  sellerId,
  promptId,
  price,
}: {
  buyerId: string;
  sellerId: string;
  promptId: string;
  price: number | null;
}) {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('purchases')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('prompt_id', promptId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message || 'Failed to check purchases');

  const numericPrice = price !== null && price !== undefined ? Number(price) : null;
  const payload: Record<string, unknown> = {
    buyer_id: buyerId,
    seller_id: sellerId,
    prompt_id: promptId,
  };

  if (Number.isFinite(numericPrice)) {
    payload.price = Number(numericPrice);
  }

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin.from('purchases').update(payload).eq('id', existing.id);
    if (updateError) throw new Error(updateError.message || 'Failed to update purchase');
    return false;
  }

  const { error: insertError } = await supabaseAdmin.from('purchases').insert(payload);
  if (insertError) {
    if (insertError.code === '23505') return false;
    throw new Error(insertError.message || 'Failed to insert purchase');
  }

  return true;
}

async function creditSeller(sellerId: string | null, amount: number | null) {
  if (!sellerId) return;
  const delta = amount !== null && amount !== undefined ? Number(amount) : null;
  if (!Number.isFinite(delta) || (delta ?? 0) <= 0) return;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from<ProfileRow>('profiles')
    .select('credits')
    .eq('id', sellerId)
    .maybeSingle();

  if (profileError) {
    console.error('Failed to load seller profile', profileError);
    return;
  }

  const nextCredits = Number(profile?.credits ?? 0) + Number(delta);
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ credits: nextCredits })
    .eq('id', sellerId);

  if (updateError) {
    console.error('Failed to update seller credits', updateError);
  }
}

async function findSellerIdByAccount(accountId: string | null) {
  if (!accountId) return null;

  const { data, error } = await supabaseAdmin
    .from<ProfileRow>('profiles')
    .select('id')
    .or(`stripe_account_id.eq.${accountId},connected_account_id.eq.${accountId}`)
    .maybeSingle();

  if (error) {
    console.error('Failed to map account to seller', error);
    return null;
  }

  return data?.id ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const promptId =
    readMetadata(session.metadata, ['prompt_id', 'promptId']) ??
    (session.metadata?.prompt as string | undefined) ??
    null;
  const buyerId = readMetadata(session.metadata, ['user_id', 'buyer_id', 'buyerId', 'userId']);
  if (!promptId || !buyerId) {
    console.warn('Missing required metadata on checkout.session.completed', {
      promptId,
      buyerId,
      sessionId: session.id,
    });
    return;
  }

  const prompt = await fetchPrompt(promptId);
  if (!prompt) {
    throw new Error(`Prompt ${promptId} not found`);
  }

  const sellerId =
    readMetadata(session.metadata, ['seller_id', 'sellerId']) ?? prompt.user_id ?? undefined;
  const amount = centsToDollars(session.amount_total ?? session.amount_subtotal ?? null);
  const price = amount ?? (prompt.price !== null ? Number(prompt.price) : null);

  const created = await ensurePurchase({
    buyerId,
    sellerId: sellerId || prompt.user_id || buyerId,
    promptId: prompt.id,
    price,
  });

  if (created) {
    await creditSeller(sellerId ?? prompt.user_id, price);
  }
}

async function handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
  const promptId =
    readMetadata(intent.metadata, ['prompt_id', 'promptId']) ??
    (intent.metadata?.prompt as string | undefined) ??
    null;
  const buyerId = readMetadata(intent.metadata, ['user_id', 'buyer_id', 'buyerId', 'userId']);

  if (!promptId || !buyerId) {
    console.warn('Missing metadata on payment_intent.succeeded', { promptId, buyerId, intentId: intent.id });
    return;
  }

  const prompt = await fetchPrompt(promptId);
  if (!prompt) {
    throw new Error(`Prompt ${promptId} not found`);
  }

  const sellerId =
    readMetadata(intent.metadata, ['seller_id', 'sellerId']) ?? prompt.user_id ?? undefined;
  const amount = centsToDollars(intent.amount_received ?? intent.amount ?? null);
  const price = amount ?? (prompt.price !== null ? Number(prompt.price) : null);

  const created = await ensurePurchase({
    buyerId,
    sellerId: sellerId || prompt.user_id || buyerId,
    promptId: prompt.id,
    price,
  });

  if (created) {
    await creditSeller(sellerId ?? prompt.user_id, price);
  }
}

async function handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const promptId =
    readMetadata(intent.metadata, ['prompt_id', 'promptId']) ??
    (intent.metadata?.prompt as string | undefined) ??
    null;
  const buyerId = readMetadata(intent.metadata, ['user_id', 'buyer_id', 'buyerId', 'userId']);

  console.error('Payment intent failed', {
    intentId: intent.id,
    promptId,
    buyerId,
    failureCode: intent.last_payment_error?.code,
    failureMessage: intent.last_payment_error?.message,
  });
}

async function handleTransferPaid(transfer: Stripe.Transfer) {
  const accountId =
    typeof transfer.destination === 'string'
      ? transfer.destination
      : transfer.destination?.id ?? null;
  const sellerIdFromMetadata = readMetadata(transfer.metadata, [
    'seller_id',
    'user_id',
    'owner_id',
    'creator_id',
  ]);
  const sellerId = sellerIdFromMetadata ?? (await findSellerIdByAccount(accountId));

  if (!sellerId) {
    console.warn('transfer.paid received but seller could not be resolved', {
      transferId: transfer.id,
      accountId,
    });
    return;
  }

  const amount = centsToDollars(transfer.amount ?? null);
  const payload: Record<string, unknown> = {
    seller_id: sellerId,
    amount,
    currency: transfer.currency,
    stripe_transfer_id: transfer.id,
    destination_account: accountId,
    created_at: transfer.created ? new Date(transfer.created * 1000).toISOString() : new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from('payouts').insert(payload);
  if (error) {
    if (error.code === '23505') return;
    throw new Error(error.message || 'Failed to record payout');
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  // Use the raw body to ensure Stripe signature verification works as expected.
  const rawBody = Buffer.from(await req.arrayBuffer());

  if (!signature) {
    console.error('Missing Stripe signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Invalid signature' }, { status: 400 });
  }

  try {
    if (await eventAlreadyProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'transfer.paid':
        await handleTransferPaid(event.data.object as Stripe.Transfer);
        break;
      default:
    }

    await markEventProcessed(event);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    await logError(err, { scope: 'stripe_webhook', eventId: event?.id, type: event?.type });
    console.error('Stripe webhook handler failed', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Webhook processing failed' }, { status: 400 });
  }
}
