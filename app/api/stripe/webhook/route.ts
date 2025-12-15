import { createHash } from 'crypto';
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { StripeWebhookHandler } from '@/lib/stripe/webhook-handler';
import { createNotification } from '@/lib/notifications';
import { AppError, ErrorCategory, isOperationalError } from '@/lib/errors';
import { logger } from '@/lib/logging';
import { BusinessEventLogger } from '@/lib/middleware/api-handler';
import { withRequestIdHeader } from '@/lib/api/request-id';
import { recordSystemEvent } from '@/lib/system-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

let cachedWebhookHandler: StripeWebhookHandler | null = null;

export function getWebhookHandler(): StripeWebhookHandler {
  if (!cachedWebhookHandler) {
    cachedWebhookHandler = new StripeWebhookHandler();
  }
  return cachedWebhookHandler;
}

export function setWebhookHandler(handler: StripeWebhookHandler | null) {
  cachedWebhookHandler = handler;
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseAdminClient>>;
type PurchaseRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  prompt_id: string | number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_total: number | null;
  refunded_amount: number | null;
  status: string | null;
  currency: string | null;
  refund_reason?: string | null;
};

const STATUS_ORDER = ['refunded', 'disputed', 'partially_refunded', 'paid', 'failed', 'pending'] as const;
type PurchaseStatus = (typeof STATUS_ORDER)[number];

const STRIPE_HANDLER_LABELS = {
  checkoutCompleted: 'CHECKOUT_COMPLETED',
  paymentSucceeded: 'PAYMENT_INTENT_SUCCEEDED',
  refundApplied: 'CHARGE_REFUNDED',
  disputeCreated: 'DISPUTE_CREATED',
};

function prioritizeStatus(current: string | null | undefined, incoming: PurchaseStatus): PurchaseStatus {
  const currentIndex = STATUS_ORDER.indexOf((current ?? 'pending') as PurchaseStatus);
  const incomingIndex = STATUS_ORDER.indexOf(incoming);

  if (currentIndex === -1) return incoming;
  if (incomingIndex === -1) return (current ?? 'pending') as PurchaseStatus;

  return STATUS_ORDER[Math.min(currentIndex, incomingIndex)];
}

function stripeTimestampToIso(seconds?: number) {
  return seconds ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

function hashPayload(payload: any) {
  return createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
}

function summarizeEventPayload(event: Stripe.Event) {
  const object: any = event.data?.object ?? {};
  return {
    object: object.object,
    id: object.id,
    type: event.type,
    payment_intent: object.payment_intent ?? object.id ?? null,
    charge: object.charge ?? null,
    amount: object.amount ?? object.amount_total ?? null,
    refund_id: object.object === 'refund' ? object.id : undefined,
  };
}

async function recordStripeEvent(
  supabase: SupabaseClient,
  event: Stripe.Event,
  requestId: string
) {
  const stripeCreatedAt = event.created ? stripeTimestampToIso(event.created) : null;
  const payload = summarizeEventPayload(event);

  const { error } = await supabase
    .from('stripe_events')
    .insert({
      event_id: event.id,
      type: event.type,
      livemode: Boolean(event.livemode),
      stripe_created_at: stripeCreatedAt,
      payload,
      request_id: requestId,
    });

  if (!error) return { alreadyProcessed: false };

  if (error.code === '23505') {
    const { data: existing, error: fetchError } = await supabase
      .from('stripe_events')
      .select('processed_at')
      .eq('event_id', event.id)
      .maybeSingle();

    if (fetchError) {
      throw new AppError(
        ErrorCategory.EXTERNAL,
        'DATABASE_ERROR',
        'Failed to inspect existing Stripe event',
        { details: fetchError.message }
      );
    }

    if (existing?.processed_at) {
      return { alreadyProcessed: true, processedAt: existing.processed_at };
    }

    return { alreadyProcessed: false, existing: true };
  }

  throw new AppError(
    ErrorCategory.EXTERNAL,
    'DATABASE_ERROR',
    'Failed to record Stripe event',
    { details: error.message }
  );
}

async function markStripeEventProcessed(
  supabase: SupabaseClient,
  event: Stripe.Event,
  requestId: string
) {
  const payloadHash = hashPayload(event.data?.object ?? {});
  const { error } = await supabase
    .from('stripe_events')
    .update({
      processed_at: new Date().toISOString(),
      payload_hash: payloadHash,
      request_id: requestId,
    })
    .eq('event_id', event.id);

  if (error) {
    throw new AppError(
      ErrorCategory.EXTERNAL,
      'DATABASE_ERROR',
      'Failed to mark Stripe event processed',
      { details: error.message }
    );
  }
}

async function findPurchase(
  supabase: SupabaseClient,
  refs: {
    purchaseId?: string | null;
    paymentIntentId?: string | null;
    checkoutSessionId?: string | null;
    buyerId?: string | null;
    promptId?: string | number | null;
  }
): Promise<PurchaseRow | null> {
  const selectors: { column: string; value?: string | number | null }[] = [
    { column: 'id', value: refs.purchaseId },
    { column: 'stripe_payment_intent_id', value: refs.paymentIntentId },
    { column: 'stripe_checkout_session_id', value: refs.checkoutSessionId },
  ];

  for (const selector of selectors) {
    if (!selector.value) continue;
    const { data, error } = await supabase
      .from('purchases')
      .select(
        'id,buyer_id,seller_id,prompt_id,stripe_checkout_session_id,stripe_payment_intent_id,amount_total,refunded_amount,status,currency,refund_reason'
      )
      .eq(selector.column, selector.value as any)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(
        ErrorCategory.EXTERNAL,
        'DATABASE_ERROR',
        'Failed to load purchase',
        { details: error.message }
      );
    }

    if (data) return data as PurchaseRow;
  }

  if (refs.buyerId && refs.promptId) {
    const { data, error } = await supabase
      .from('purchases')
      .select(
        'id,buyer_id,seller_id,prompt_id,stripe_checkout_session_id,stripe_payment_intent_id,amount_total,refunded_amount,status,currency,refund_reason'
      )
      .eq('buyer_id', refs.buyerId)
      .eq('prompt_id', refs.promptId as any)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(
        ErrorCategory.EXTERNAL,
        'DATABASE_ERROR',
        'Failed to load purchase by buyer/prompt',
        { details: error.message }
      );
    }

    if (data) return data as PurchaseRow;
  }

  return null;
}

async function upsertPurchaseFromStripe(
  supabase: SupabaseClient,
  input: {
    buyerId: string;
    sellerId: string;
    promptId: string | number;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    amountTotal: number;
    currency: string;
    status: PurchaseStatus;
    lastStripeEventId: string;
    priceCents?: number;
  },
  requestId: string
): Promise<string | null> {
  const purchase = await findPurchase(supabase, {
    paymentIntentId: input.stripePaymentIntentId,
    checkoutSessionId: input.stripeCheckoutSessionId,
    buyerId: input.buyerId,
    promptId: input.promptId,
  });

  const targetStatus = prioritizeStatus(purchase?.status, input.status);

  if (purchase) {
    const updates: Record<string, any> = {
      last_stripe_event_id: input.lastStripeEventId,
    };

    if (input.stripeCheckoutSessionId && !purchase.stripe_checkout_session_id) {
      updates.stripe_checkout_session_id = input.stripeCheckoutSessionId;
    }

    if (input.stripePaymentIntentId && !purchase.stripe_payment_intent_id) {
      updates.stripe_payment_intent_id = input.stripePaymentIntentId;
    }

    if (!purchase.amount_total || purchase.amount_total !== input.amountTotal) {
      updates.amount_total = input.amountTotal;
    }

    if (!purchase.currency || purchase.currency !== input.currency) {
      updates.currency = input.currency;
    }

    if (purchase.status !== targetStatus) {
      updates.status = targetStatus;
    }

    if (
      input.priceCents &&
      (!purchase.amount_total || purchase.amount_total === 0)
    ) {
      updates.price = Number((input.priceCents / 100).toFixed(2));
    }

    const shouldUpdate = Object.keys(updates).length > 0;
    if (shouldUpdate) {
      const { error } = await supabase
        .from('purchases')
        .update(updates)
        .eq('id', purchase.id);

      if (error) {
        throw new AppError(
          ErrorCategory.EXTERNAL,
          'DATABASE_ERROR',
          'Failed to update purchase',
          { details: error.message }
        );
      }
      try {
        const adminClient =
          supabaseAdmin ?? (await createSupabaseAdminClient().catch(() => null));
        if (adminClient) {
          await recordSystemEvent(adminClient, {
            type: 'stripe/webhook',
            requestId,
            payloadSummary: verifiedEvent
              ? { eventId: verifiedEvent.id, eventType: verifiedEvent.type }
              : null,
            errorMessage: error?.message ?? 'Webhook processing failed',
          });
        }
      } catch (logError) {
        logger.error(
          'Failed to log webhook failure to system events',
          { requestId },
          logError as Error,
          'SYSTEM_EVENT_WEBHOOK_LOG_FAILED'
        );
      }

      logger.info('Purchase reconciled from Stripe event', {
        requestId,
        purchaseId: purchase.id,
        status: targetStatus,
        updates,
      }, 'PURCHASE_UPDATED');
    } else {
      logger.info('Purchase already up to date for Stripe event', {
        requestId,
        purchaseId: purchase.id,
      }, 'PURCHASE_ALREADY_CURRENT');
    }

    return purchase.id;
  }

  const priceCents = input.priceCents ?? input.amountTotal;
  const insertPayload = {
    buyer_id: input.buyerId,
    seller_id: input.sellerId,
    prompt_id: input.promptId,
    stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
    stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    amount_total: input.amountTotal,
    refunded_amount: 0,
    currency: input.currency,
    status: input.status,
    last_stripe_event_id: input.lastStripeEventId,
    price: Number((priceCents / 100).toFixed(2)),
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase
    .from('purchases')
    .insert(insertPayload)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      const existing = await findPurchase(supabase, {
        paymentIntentId: input.stripePaymentIntentId,
        checkoutSessionId: input.stripeCheckoutSessionId,
        buyerId: input.buyerId,
        promptId: input.promptId,
      });
      return existing?.id ?? null;
    }

    throw new AppError(
      ErrorCategory.EXTERNAL,
      'DATABASE_ERROR',
      'Failed to create purchase',
      { details: error.message }
    );
  }

  if (!inserted?.id) return null;

  logger.info('Purchase created from Stripe event', {
    requestId,
    purchaseId: inserted.id,
    status: input.status,
  }, 'PURCHASE_CREATED');

  return inserted.id;
}

async function reconcileRefund(
  supabase: SupabaseClient,
  charge: Stripe.Charge,
  eventId: string,
  requestId: string,
  stripeCreated?: number
) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  const checkoutSessionId =
    charge.metadata?.stripe_checkout_session_id ??
    charge.metadata?.checkout_session_id ??
    null;
  const purchaseId = charge.metadata?.purchase_id ?? null;
  const refundedAmount = charge.amount_refunded ?? 0;
  const totalAmount = charge.amount ?? refundedAmount;
  const refundReason =
    charge.refunds?.data?.[0]?.reason ??
    charge.refunds?.data?.[0]?.metadata?.reason ??
    charge.metadata?.refund_reason ??
    null;

  let purchase = await findPurchase(supabase, {
    purchaseId,
    paymentIntentId,
    checkoutSessionId,
  });

  if (!purchase && charge.metadata?.prompt_id && charge.metadata?.buyer_id && charge.metadata?.seller_id) {
    await upsertPurchaseFromStripe(
      supabase,
      {
        buyerId: charge.metadata.buyer_id,
        sellerId: charge.metadata.seller_id,
        promptId: charge.metadata.prompt_id,
        stripeCheckoutSessionId: checkoutSessionId ?? undefined,
        stripePaymentIntentId: paymentIntentId ?? undefined,
        amountTotal: totalAmount,
        currency: charge.currency,
        status: refundedAmount >= totalAmount ? 'refunded' : 'partially_refunded',
        lastStripeEventId: eventId,
        priceCents: totalAmount,
      },
      requestId
    );
    purchase = await findPurchase(supabase, {
      purchaseId,
      paymentIntentId,
      checkoutSessionId,
      buyerId: charge.metadata.buyer_id,
      promptId: charge.metadata.prompt_id,
    });
  }

  if (!purchase) {
    logger.warn('Refund received but purchase not found', {
      requestId,
      paymentIntentId,
      checkoutSessionId,
      purchaseId,
    }, STRIPE_HANDLER_LABELS.refundApplied);
    return;
  }

  const currentRefunded = purchase.refunded_amount ?? 0;
  const amountTotal = purchase.amount_total && purchase.amount_total > 0 ? purchase.amount_total : totalAmount;
  const nextRefundedAmount = Math.max(currentRefunded, refundedAmount);
  const computedStatus =
    nextRefundedAmount >= amountTotal && amountTotal > 0
      ? 'refunded'
      : 'partially_refunded';
  const targetStatus = prioritizeStatus(purchase.status, computedStatus as PurchaseStatus);

  const updates: Record<string, any> = {
    refunded_amount: nextRefundedAmount,
    amount_total: amountTotal,
    status: targetStatus,
    refund_reason: refundReason ?? purchase.refund_reason ?? null,
    refunded_at: stripeTimestampToIso(stripeCreated),
    last_stripe_event_id: eventId,
    stripe_payment_intent_id: paymentIntentId ?? purchase.stripe_payment_intent_id,
  };

  const { error } = await supabase
    .from('purchases')
    .update(updates)
    .eq('id', purchase.id);

  if (error) {
    throw new AppError(
      ErrorCategory.EXTERNAL,
      'DATABASE_ERROR',
      'Failed to apply refund to purchase',
      { details: error.message }
    );
  }

  logger.info('Refund reconciled to purchase', {
    requestId,
    purchaseId: purchase.id,
    status: targetStatus,
    refundedAmount: nextRefundedAmount,
    amountTotal,
  }, STRIPE_HANDLER_LABELS.refundApplied);

  try {
    const humanAmount = nextRefundedAmount / 100;
    const title =
      targetStatus === 'refunded'
        ? 'Refund processed'
        : 'Partial refund processed';
    await createNotification(supabase, {
      userId: purchase.buyer_id,
      type: 'refund.processed',
      title,
      body: `A refund of ${humanAmount} ${charge.currency} was processed for your purchase.`,
      url: '/purchases',
      requestId,
    });
  } catch (notifyError) {
    logger.warn('Failed to notify buyer about refund', {
      requestId,
      purchaseId: purchase.id,
      error: (notifyError as Error)?.message,
    }, 'REFUND_NOTIFICATION_FAILED');
  }
}

async function handleCheckoutCompleted(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  eventId: string,
  requestId: string,
  stripeCreated?: number
) {
  const { promptId, buyerId, sellerId } = StripeWebhookHandler.validatePurchaseMetadata(session);
  const amountTotal = session.amount_total ?? session.amount_subtotal;

  if (!amountTotal || amountTotal <= 0) {
    throw new AppError(
      ErrorCategory.VALIDATION,
      'INVALID_AMOUNT',
      'Checkout session missing amount_total',
      { sessionId: session.id },
      400
    );
  }

  const { data: prompt, error: promptError } = await supabase
    .from('prompts')
    .select('id, user_id, price')
    .eq('id', promptId)
    .maybeSingle();

  if (promptError || !prompt) {
    throw new AppError(
      ErrorCategory.RESOURCE,
      'PROMPT_NOT_FOUND',
      `Prompt ${promptId} not found`,
      { details: promptError?.message },
      404
    );
  }

  const finalSellerId = sellerId || prompt.user_id;
  if (!finalSellerId) {
    throw new AppError(
      ErrorCategory.RESOURCE,
      'SELLER_NOT_FOUND',
      'No seller found for prompt',
      { promptId },
      404
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  await upsertPurchaseFromStripe(
    supabase,
    {
      buyerId,
      sellerId: finalSellerId,
      promptId: prompt.id,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId ?? undefined,
      amountTotal,
      currency: session.currency || 'usd',
      status: 'paid',
      lastStripeEventId: eventId,
      priceCents: amountTotal,
    },
    requestId
  );

  logger.info('Checkout session handled', {
    requestId,
    sessionId: session.id,
    promptId,
    buyerId,
    sellerId: finalSellerId,
    amountTotal,
    stripeCreatedAt: stripeTimestampToIso(stripeCreated),
  }, STRIPE_HANDLER_LABELS.checkoutCompleted);
}

async function handlePaymentIntentSucceeded(
  supabase: SupabaseClient,
  intent: Stripe.PaymentIntent,
  eventId: string,
  requestId: string
) {
  const promptId = StripeWebhookHandler.extractMetadata(intent.metadata, ['prompt_id', 'promptId']);
  const buyerId = StripeWebhookHandler.extractMetadata(intent.metadata, ['user_id', 'buyer_id', 'buyerId', 'userId']);

  if (!promptId || !buyerId) {
    logger.warn('Payment intent missing metadata, skipping purchase sync', {
      requestId,
      paymentIntentId: intent.id,
      promptId,
      buyerId,
    }, STRIPE_HANDLER_LABELS.paymentSucceeded);
    return;
  }

  const amountTotal = intent.amount_received ?? intent.amount;
  if (!amountTotal || amountTotal <= 0) {
    throw new AppError(
      ErrorCategory.VALIDATION,
      'INVALID_AMOUNT',
      'Payment intent missing amount',
      { paymentIntentId: intent.id },
      400
    );
  }

  const { data: prompt, error: promptError } = await supabase
    .from('prompts')
    .select('id, user_id')
    .eq('id', promptId)
    .maybeSingle();

  if (promptError || !prompt) {
    throw new AppError(
      ErrorCategory.RESOURCE,
      'PROMPT_NOT_FOUND',
      `Prompt ${promptId} not found`,
      { details: promptError?.message },
      404
    );
  }

  await upsertPurchaseFromStripe(
    supabase,
    {
      buyerId,
      sellerId: prompt.user_id,
      promptId: prompt.id,
      stripeCheckoutSessionId: undefined,
      stripePaymentIntentId: intent.id,
      amountTotal,
      currency: intent.currency || 'usd',
      status: 'paid',
      lastStripeEventId: eventId,
      priceCents: amountTotal,
    },
    requestId
  );
}

async function handlePaymentIntentFailed(
  supabase: SupabaseClient,
  intent: Stripe.PaymentIntent,
  eventId: string,
  requestId: string
) {
  const purchase = await findPurchase(supabase, {
    paymentIntentId: intent.id,
    buyerId: StripeWebhookHandler.extractMetadata(intent.metadata, ['user_id', 'buyer_id', 'buyerId', 'userId']),
    promptId: StripeWebhookHandler.extractMetadata(intent.metadata, ['prompt_id', 'promptId']),
  });

  if (!purchase) return;

  const { error } = await supabase
    .from('purchases')
    .update({
      status: prioritizeStatus(purchase.status, 'failed'),
      last_stripe_event_id: eventId,
    })
    .eq('id', purchase.id);

  if (error) {
    throw new AppError(
      ErrorCategory.EXTERNAL,
      'DATABASE_ERROR',
      'Failed to mark purchase failed',
      { details: error.message }
    );
  }

  logger.warn('Payment intent marked as failed', {
    requestId,
    purchaseId: purchase.id,
    paymentIntentId: intent.id,
  }, 'PAYMENT_FAILED');
}

async function handleDisputeCreated(
  supabase: SupabaseClient,
  dispute: Stripe.Dispute,
  eventId: string,
  requestId: string
) {
  const paymentIntentId =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? null;
  const chargeId =
    typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null;

  const purchase = await findPurchase(supabase, {
    paymentIntentId,
    checkoutSessionId: dispute.metadata?.stripe_checkout_session_id ?? null,
    purchaseId: dispute.metadata?.purchase_id ?? null,
  });

  if (!purchase) {
    logger.warn('Dispute received but purchase not found', {
      requestId,
      paymentIntentId,
      chargeId,
    }, STRIPE_HANDLER_LABELS.disputeCreated);
    return;
  }

  const { error } = await supabase
    .from('purchases')
    .update({
      status: prioritizeStatus(purchase.status, 'disputed'),
      last_stripe_event_id: eventId,
    })
    .eq('id', purchase.id);

  if (error) {
    throw new AppError(
      ErrorCategory.EXTERNAL,
      'DATABASE_ERROR',
      'Failed to mark purchase disputed',
      { details: error.message }
    );
  }

  logger.warn('Purchase marked as disputed', {
    requestId,
    purchaseId: purchase.id,
    paymentIntentId,
    chargeId,
  }, STRIPE_HANDLER_LABELS.disputeCreated);
}

async function handleAccountUpdated(
  supabase: SupabaseClient,
  account: Stripe.Account,
  eventId: string,
  requestId: string
) {
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const status = account.requirements?.disabled_reason || null;

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_account_status: status,
      stripe_account_id: account.id,
      connected_account_id: account.id,
    })
    .eq('stripe_account_id', account.id);

  if (error) {
    throw new AppError(
      ErrorCategory.EXTERNAL,
      'DATABASE_ERROR',
      'Failed to update Stripe account status',
      { details: error.message },
      500
    );
  }

  logger.info('Stripe account updated', {
    requestId,
    accountId: account.id,
    chargesEnabled,
    payoutsEnabled,
    status,
  }, 'ACCOUNT_UPDATED');
}

async function processEvent(
  supabase: SupabaseClient,
  event: Stripe.Event,
  requestId: string
) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(
        supabase,
        event.data.object as Stripe.Checkout.Session,
        event.id,
        requestId,
        event.created
      );
      break;

    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(
        supabase,
        event.data.object as Stripe.PaymentIntent,
        event.id,
        requestId
      );
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(
        supabase,
        event.data.object as Stripe.PaymentIntent,
        event.id,
        requestId
      );
      break;

    case 'charge.refunded':
      await reconcileRefund(
        supabase,
        event.data.object as Stripe.Charge,
        event.id,
        requestId,
        event.created
      );
      break;

    case 'charge.dispute.created':
      await handleDisputeCreated(
        supabase,
        event.data.object as Stripe.Dispute,
        event.id,
        requestId
      );
      break;

    case 'account.updated':
      await handleAccountUpdated(
        supabase,
        event.data.object as Stripe.Account,
        event.id,
        requestId
      );
      break;

    default:
      logger.info('Unhandled Stripe event type', {
        requestId,
        eventType: event.type,
        eventId: event.id,
      }, 'UNHANDLED_STRIPE_EVENT');
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  let supabaseAdmin: SupabaseClient | null = null;
  let verifiedEvent: Stripe.Event | null = null;

  try {
    const signature = req.headers.get('stripe-signature');
    const rawBody = Buffer.from(await req.arrayBuffer());

    if (!signature) {
      logger.error('Missing Stripe signature header', { requestId }, new Error('Missing Stripe signature'), 'MISSING_SIGNATURE');
      return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
    }

    const webhookHandler = getWebhookHandler();
    const event = webhookHandler.verifySignature(rawBody, signature, requestId);
    verifiedEvent = event;
    const supabase = await createSupabaseAdminClient();
    supabaseAdmin = supabase;

    const eventRecord = await recordStripeEvent(supabase, event, requestId);
    if (eventRecord.alreadyProcessed) {
      logger.info('Stripe event already processed, skipping', {
        requestId,
        eventId: event.id,
        eventType: event.type,
      }, 'EVENT_ALREADY_PROCESSED');

      return NextResponse.json({ received: true, duplicate: true, requestId }, { status: 200 });
    }

    await processEvent(supabase, event, requestId);
    await markStripeEventProcessed(supabase, event, requestId);
    await BusinessEventLogger.logStripeWebhook(event.type, event.id, 'success');

    const duration = Date.now() - startTime;
    logger.info('Stripe webhook processed', {
      requestId,
      eventId: event.id,
      eventType: event.type,
      duration,
    }, 'WEBHOOK_PROCESSED_SUCCESS');

    return withRequestIdHeader(NextResponse.json({ received: true, requestId, duration }, { status: 200 }), requestId);
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('Webhook processing failed', {
      requestId,
      duration,
      errorType: error?.constructor?.name,
      errorMessage: error?.message,
    }, error as Error, 'WEBHOOK_PROCESSING_FAILED');

    let statusCode = 500;
    let errorMessage = 'Webhook processing failed';

    if (isOperationalError(error)) {
      statusCode = (error as AppError).statusCode || 500;
      errorMessage = (error as AppError).message;
    }

    try {
      await BusinessEventLogger.logStripeWebhook('unknown', 'unknown', 'failed');
    } catch (logError) {
      logger.error('Failed to log webhook failure business event', { requestId }, logError as Error, 'WEBHOOK_BUSINESS_LOG_FAILED');
    }

    return withRequestIdHeader(
      NextResponse.json(
        {
          error: errorMessage,
          requestId,
          duration,
          retry: statusCode >= 500,
        },
        { status: statusCode }
      ),
      requestId
    );
  }
}
