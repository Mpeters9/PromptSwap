import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StripeWebhookHandler, PurchaseCreationData, PayoutCreationData } from '@/lib/stripe/webhook-handler';

import { AppError, isOperationalError, ErrorCategory } from '@/lib/errors';
import { logger } from '@/lib/logging';
import { BusinessEventLogger } from '@/lib/middleware/api-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

// Initialize webhook handler
const webhookHandler = new StripeWebhookHandler();

/**
 * Handle checkout.session.completed events
 */
async function handleCheckoutCompleted(
  supabase: any, 
  session: any,
  requestId: string
): Promise<void> {
  try {
    logger.info('Processing checkout.session.completed', {
      requestId,
      sessionId: session.id,
      amount: session.amount_total,
      currency: session.currency,
    }, 'CHECKOUT_COMPLETED_START');

    // Validate metadata
    const { promptId, buyerId, sellerId } = StripeWebhookHandler.validatePurchaseMetadata(session);

    // Fetch prompt to get seller and price info
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, user_id, price, title')
      .eq('id', promptId)
      .single();


    if (promptError) {
      throw new AppError(ErrorCategory.RESOURCE, 'PROMPT_NOT_FOUND', `Prompt ${promptId} not found`, 404, {
        details: promptError.message
      });
    }

    // Use metadata seller ID or prompt
    const finalSellerId = sellerId || prompt.user_id;
    if (!finalSellerId) {
      throw new AppError(ErrorCategory.RESOURCE, 'SELLER_NOT_FOUND', 'No seller found for prompt', 404, {
        promptId,
        sellerId,
        promptUserId: prompt.user_id
      });
    }

    // Convert amount from cents to dollars
    const amount = StripeWebhookHandler.centsToDollars(session.amount_total ?? session.amount_subtotal ?? null);
    const price = amount ?? (prompt.price !== null ? Number(prompt.price) : null);

    if (!price) {
      throw new AppError(ErrorCategory.VALIDATION, 'INVALID_PRICE', 'No valid price found for purchase', 400, {
        sessionAmount: session.amount_total,
        promptPrice: prompt.price
      });
    }

    // Create purchase with idempotency
    const purchaseData: PurchaseCreationData = {
      buyerId,
      sellerId: finalSellerId,
      promptId: prompt.id,
      stripeSessionId: session.id,
      amount: price,
      currency: session.currency || 'usd',
    };

    const { created, purchaseId } = await webhookHandler.createPurchase(supabase, purchaseData);

    if (created) {
      // Log business event
      await BusinessEventLogger.logPurchaseEvent('created', {
        promptId: prompt.id,
        userId: buyerId,
        amount: price,
        stripeSessionId: session.id,
      });

      // Update seller credits
      await updateSellerCredits(supabase, finalSellerId, price, requestId);

      logger.info('Purchase created and credits updated', {
        requestId,
        purchaseId,
        buyerId,
        sellerId: finalSellerId,
        promptId,
        amount: price,
      }, 'PURCHASE_COMPLETED');
    } else {
      logger.info('Purchase already existed, skipping credit update', {
        requestId,
        purchaseId,
        buyerId,
        promptId,
      }, 'PURCHASE_ALREADY_EXISTS');
    }

  } catch (error) {
    logger.error('Failed to process checkout completion', {
      requestId,
      sessionId: session.id,
    }, error as Error, 'CHECKOUT_PROCESSING_FAILED');
    
    throw error;
  }
}

/**
 * Handle payment_intent.succeeded events
 */
async function handlePaymentIntentSucceeded(
  supabase: any,
  intent: any,
  requestId: string
): Promise<void> {
  try {
    logger.info('Processing payment_intent.succeeded', {
      requestId,
      paymentIntentId: intent.id,
      amount: intent.amount_received,
    }, 'PAYMENT_INTENT_SUCCEEDED_START');

    const promptId = StripeWebhookHandler.extractMetadata(intent.metadata, ['prompt_id', 'promptId']);
    const buyerId = StripeWebhookHandler.extractMetadata(intent.metadata, ['user_id', 'buyer_id', 'buyerId', 'userId']);

    if (!promptId || !buyerId) {
      logger.warn('Missing required metadata on payment_intent.succeeded', {
        requestId,
        paymentIntentId: intent.id,
        promptId,
        buyerId,
      }, 'PAYMENT_METADATA_MISSING');
      return;
    }

    // Fetch prompt
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, user_id, price')
      .eq('id', promptId)
      .single();


    if (promptError) {
      throw new AppError('PROMPT_NOT_FOUND', `Prompt ${promptId} not found`, 404, {
        details: promptError.message
      });
    }

    const finalSellerId = prompt.user_id;
    const amount = StripeWebhookHandler.centsToDollars(intent.amount_received ?? intent.amount ?? null);
    const price = amount ?? (prompt.price !== null ? Number(prompt.price) : null);

    if (!price) {
      throw new AppError('INVALID_PRICE', 'No valid price found for payment intent', 400, {
        intentAmount: intent.amount_received,
        promptPrice: prompt.price
      });
    }

    // Create purchase
    const purchaseData: PurchaseCreationData = {
      buyerId,
      sellerId: finalSellerId,
      promptId: prompt.id,
      stripeSessionId: intent.id, // Use payment intent ID as session ID
      amount: price,
      currency: intent.currency || 'usd',
    };

    const { created } = await webhookHandler.createPurchase(supabase, purchaseData);

    if (created) {
      await updateSellerCredits(supabase, finalSellerId, price, requestId);

      logger.info('Payment intent purchase processed successfully', {
        requestId,
        buyerId,
        sellerId: finalSellerId,
        promptId,
        amount: price,
      }, 'PAYMENT_PURCHASE_COMPLETED');
    }

  } catch (error) {
    logger.error('Failed to process payment intent success', {
      requestId,
      paymentIntentId: intent.id,
    }, error as Error, 'PAYMENT_INTENT_PROCESSING_FAILED');
    
    throw error;
  }
}

/**
 * Handle payment_intent.payment_failed events
 */
async function handlePaymentIntentFailed(
  supabase: any,
  intent: any,
  requestId: string
): Promise<void> {
  try {
    const promptId = StripeWebhookHandler.extractMetadata(intent.metadata, ['prompt_id', 'promptId']);
    const buyerId = StripeWebhookHandler.extractMetadata(intent.metadata, ['user_id', 'buyer_id', 'buyerId', 'userId']);

    logger.error('Payment intent failed', {
      requestId,
      paymentIntentId: intent.id,
      promptId,
      buyerId,
      failureCode: intent.last_payment_error?.code,
      failureMessage: intent.last_payment_error?.message,
    }, new Error(`Payment failed: ${intent.last_payment_error?.message || 'Unknown error'}`), 'PAYMENT_INTENT_FAILED');

    // Log business event for failed purchase
    if (promptId && buyerId) {
      await BusinessEventLogger.logPurchaseEvent('failed', {
        promptId,
        userId: buyerId,
        amount: 0, // No amount for failed payments
        error: intent.last_payment_error?.message || 'Unknown payment failure',
      });
    }

  } catch (error) {
    logger.error('Failed to process payment intent failure', {
      requestId,
      paymentIntentId: intent.id,
    }, error as Error, 'PAYMENT_FAILURE_PROCESSING_FAILED');
    
    // Don't throw - we want to acknowledge receipt even if logging fails
  }
}

/**
 * Handle transfer.created events
 */
async function handleTransferCreated(
  supabase: any,
  transfer: any,
  requestId: string
): Promise<void> {
  try {
    logger.info('Processing transfer.created', {
      requestId,
      transferId: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination,
    }, 'TRANSFER_CREATED_START');

    const { sellerId, accountId } = StripeWebhookHandler.validateTransferMetadata(transfer);

    // If no seller ID in metadata, try to find by account ID
    let finalSellerId = sellerId;
    if (!finalSellerId && accountId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .or(`stripe_account_id.eq.${accountId},connected_account_id.eq.${accountId}`)
        .maybeSingle();

      finalSellerId = profile?.id;
    }

    if (!finalSellerId) {
      logger.warn('Could not resolve seller for transfer', {
        requestId,
        transferId: transfer.id,
        accountId,
        sellerId,
      }, 'TRANSFER_SELLER_NOT_FOUND');
      return;
    }

    // Create payout record
    const payoutData: PayoutCreationData = {
      sellerId: finalSellerId,
      amount: StripeWebhookHandler.centsToDollars(transfer.amount),
      currency: transfer.currency,
      stripeTransferId: transfer.id,
      destinationAccount: accountId,
    };

    const { created } = await webhookHandler.createPayout(supabase, payoutData);

    if (created) {
      logger.info('Payout created successfully', {
        requestId,
        sellerId: finalSellerId,
        amount: payoutData.amount,
        transferId: transfer.id,
      }, 'PAYOUT_CREATED');
    }

  } catch (error) {
    logger.error('Failed to process transfer', {
      requestId,
      transferId: transfer.id,
    }, error as Error, 'TRANSFER_PROCESSING_FAILED');
    
    throw error;
  }
}

/**
 * Update seller credits atomically
 */
async function updateSellerCredits(
  supabase: any,
  sellerId: string,
  amount: number,
  requestId: string
): Promise<void> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', sellerId)
      .single();

    if (profileError) {
      throw new AppError('PROFILE_NOT_FOUND', `Seller profile ${sellerId} not found`, 404, {
        details: profileError.message
      });
    }

    const currentCredits = Number(profile.credits ?? 0);
    const newCredits = currentCredits + amount;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', sellerId);

    if (updateError) {
      throw new AppError('CREDIT_UPDATE_FAILED', 'Failed to update seller credits', 500, {
        details: updateError.message
      });
    }

    logger.info('Seller credits updated', {
      requestId,
      sellerId,
      previousCredits: currentCredits,
      addedAmount: amount,
      newCredits,
    }, 'CREDITS_UPDATED');

  } catch (error) {
    logger.error('Failed to update seller credits', {
      requestId,
      sellerId,
      amount,
    }, error as Error, 'CREDIT_UPDATE_FAILED');
    
    throw error;
  }
}

/**
 * Main webhook handler
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Extract signature and raw body
    const signature = req.headers.get('stripe-signature');
    const rawBody = await req.text();

    if (!signature) {
      logger.error('Missing Stripe signature header', {
        requestId,
      }, new Error('Missing Stripe signature'), 'MISSING_SIGNATURE');
      
      return NextResponse.json(
        { error: 'Missing Stripe signature' }, 
        { status: 400 }
      );
    }

    // Verify signature (this must happen before any DB operations)
    const event = await webhookHandler.verifySignature(rawBody, signature);

    // Initialize Supabase client for this request
    const supabase = await createSupabaseServerClient();

    // Check if event was already processed (idempotency)
    if (await webhookHandler.isEventProcessed(supabase, event.id)) {
      logger.info('Event already processed, skipping', {
        requestId,
        eventId: event.id,
        eventType: event.type,
      }, 'EVENT_ALREADY_PROCESSED');

      return NextResponse.json({ 
        received: true, 
        duplicate: true,
        requestId 
      }, { status: 200 });
    }

    // Process the event
    logger.info('Processing Stripe webhook event', {
      requestId,
      eventId: event.id,
      eventType: event.type,
      eventCreated: event.created,
    }, 'WEBHOOK_EVENT_PROCESSING_START');

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object, requestId);
        break;
        
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(supabase, event.data.object, requestId);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(supabase, event.data.object, requestId);
        break;
        
      case 'transfer.created':
        await handleTransferCreated(supabase, event.data.object, requestId);
        break;
        
      default:
        logger.info('Unhandled event type', {
          requestId,
          eventType: event.type,
          eventId: event.id,
        }, 'UNHANDLED_EVENT_TYPE');
    }

    // Mark event as processed (must be after successful processing)
    await webhookHandler.markEventProcessed(supabase, event);

    // Log business event
    await BusinessEventLogger.logStripeWebhook(event.type, event.id, 'success');

    const duration = Date.now() - startTime;
    
    logger.info('Webhook processed successfully', {
      requestId,
      eventId: event.id,
      eventType: event.type,
      duration,
    }, 'WEBHOOK_PROCESSED_SUCCESS');

    return NextResponse.json({ 
      received: true,
      requestId,
      duration
    }, { status: 200 });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Log the error with full context
    logger.error('Webhook processing failed', {
      requestId,
      duration,
      errorType: error.constructor.name,
      errorMessage: error.message,
    }, error as Error, 'WEBHOOK_PROCESSING_FAILED');

    // Determine response status code
    let statusCode = 500;
    let errorMessage = 'Webhook processing failed';

    if (isOperationalError(error)) {
      const appError = error as any;
      statusCode = appError.statusCode || 500;
      errorMessage = appError.message || 'Processing error';
      
      // Don't retry for client errors (4xx)
      if (statusCode >= 400 && statusCode < 500) {
        logger.warn('Client error in webhook, not retrying', {
          requestId,
          statusCode,
          errorMessage,
        }, 'CLIENT_ERROR_NO_RETRY');
      }
    }

    // Log business event for failure
    try {
      await BusinessEventLogger.logStripeWebhook(
        'unknown', // We don't know the event type if processing failed
        'unknown',
        'failed'
      );
    } catch (businessLogError) {
      logger.error('Failed to log business event for webhook failure', {
        requestId,
      }, businessLogError as Error, 'BUSINESS_LOG_FAILED');
    }

    return NextResponse.json({ 
      error: errorMessage,
      requestId,
      duration,
      retry: statusCode >= 500 // Only retry on server errors
    }, { status: statusCode });
  }
}
