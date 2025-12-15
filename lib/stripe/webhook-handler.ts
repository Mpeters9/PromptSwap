import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BusinessEventLogger } from '@/lib/middleware/api-handler';
import { AppError, isOperationalError } from '@/lib/errors';
import { logger } from '@/lib/logging';

export interface StripeWebhookContext {
  requestId: string;
  rawBody: string;
  signature: string;
  event: Stripe.Event;
  supabase: ReturnType<typeof createSupabaseServerClient>;
}

export interface PurchaseCreationData {
  buyerId: string;
  sellerId: string;
  promptId: string;
  stripeSessionId: string;
  amount: number;
  currency: string;
}

export interface PayoutCreationData {
  sellerId: string;
  amount: number;
  currency: string;
  stripeTransferId: string;
  destinationAccount: string;
}

export class StripeWebhookHandler {
  private stripe: Stripe;
  private webhookSecret: string;
  private requestId: string;

  constructor() {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY is required');
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is required');

    this.stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10' });
    this.webhookSecret = webhookSecret;
    this.requestId = crypto.randomUUID();
  }

  /**
   * Verify Stripe signature using raw request body
   */
  async verifySignature(rawBody: string, signature: string): Promise<Stripe.Event> {
    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      
      logger.info('Stripe signature verified successfully', {
        requestId: this.requestId,
        eventId: event.id,
        eventType: event.type,
        eventCreated: event.created,
      }, 'STRIPE_SIGNATURE_VERIFIED');

      return event;
    } catch (error: any) {
      logger.error('Stripe signature verification failed', {
        requestId: this.requestId,
        error: error.message,
        errorType: error.type,
      }, error, 'STRIPE_SIGNATURE_VERIFICATION_FAILED');
      
      throw new AppError('INVALID_STRIPE_SIGNATURE', 'Invalid Stripe webhook signature', 400, {
        details: error.message
      });
    }
  }

  /**
   * Check if event has already been processed (idempotency)
   */
  async isEventProcessed(supabase: any, eventId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('stripe_events')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw new AppError('DATABASE_ERROR', 'Failed to check event processing status', 500, {
          details: error.message
        });
      }

      const isProcessed = Boolean(data);
      
      logger.info('Event processing check completed', {
        requestId: this.requestId,
        eventId,
        isProcessed,
      }, 'EVENT_PROCESSING_CHECK');

      return isProcessed;
    } catch (error) {
      logger.error('Failed to check event processing status', {
        requestId: this.requestId,
        eventId,
      }, error as Error, 'EVENT_PROCESSING_CHECK_FAILED');
      
      throw error;
    }
  }

  /**
   * Mark event as processed atomically
   */
  async markEventProcessed(supabase: any, event: Stripe.Event): Promise<void> {
    try {
      const eventData = {
        event_id: event.id,
        type: event.type,
        processed_at: new Date().toISOString(),
        request_id: this.requestId,
        payload_hash: await this.hashPayload(event.data.object),
      };

      const { error } = await supabase
        .from('stripe_events')
        .insert(eventData);

      if (error && error.code !== '23505') {
        throw new AppError('DATABASE_ERROR', 'Failed to record processed event', 500, {
          details: error.message
        });
      }

      logger.info('Event marked as processed', {
        requestId: this.requestId,
        eventId: event.id,
        eventType: event.type,
      }, 'EVENT_MARKED_PROCESSED');
    } catch (error) {
      logger.error('Failed to mark event as processed', {
        requestId: this.requestId,
        eventId: event.id,
      }, error as Error, 'EVENT_MARK_PROCESSING_FAILED');
      
      throw error;
    }
  }

  /**
   * Create purchase with proper idempotency and validation
   */
  async createPurchase(supabase: any, data: PurchaseCreationData): Promise<{ created: boolean; purchaseId?: string }> {
    try {
      // First, check if purchase already exists
      const { data: existing, error: checkError } = await supabase
        .from('purchases')
        .select('id')
        .eq('buyer_id', data.buyerId)
        .eq('prompt_id', data.promptId)
        .eq('stripe_session_id', data.stripeSessionId)
        .maybeSingle();

      if (checkError) {
        throw new AppError('DATABASE_ERROR', 'Failed to check existing purchase', 500, {
          details: checkError.message
        });
      }

      if (existing) {
        logger.info('Purchase already exists, skipping creation', {
          requestId: this.requestId,
          purchaseId: existing.id,
          buyerId: data.buyerId,
          promptId: data.promptId,
        }, 'PURCHASE_ALREADY_EXISTS');

        return { created: false, purchaseId: existing.id };
      }

      // Create new purchase
      const purchaseData = {
        buyer_id: data.buyerId,
        seller_id: data.sellerId,
        prompt_id: data.promptId,
        stripe_session_id: data.stripeSessionId,
        amount: data.amount,
        currency: data.currency,
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      const { data: purchase, error: insertError } = await supabase
        .from('purchases')
        .insert(purchaseData)
        .select('id')
        .single();

      if (insertError) {
        // Handle race condition (concurrent creation)
        if (insertError.code === '23505') {
          logger.warn('Purchase creation race condition detected', {
            requestId: this.requestId,
            buyerId: data.buyerId,
            promptId: data.promptId,
          }, 'PURCHASE_RACE_CONDITION');

          // Try to find the existing purchase
          const { data: existingPurchase } = await supabase
            .from('purchases')
            .select('id')
            .eq('buyer_id', data.buyerId)
            .eq('prompt_id', data.promptId)
            .eq('stripe_session_id', data.stripeSessionId)
            .single();

          return { created: false, purchaseId: existingPurchase?.id };
        }

        throw new AppError('DATABASE_ERROR', 'Failed to create purchase', 500, {
          details: insertError.message
        });
      }

      logger.info('Purchase created successfully', {
        requestId: this.requestId,
        purchaseId: purchase.id,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        promptId: data.promptId,
        amount: data.amount,
      }, 'PURCHASE_CREATED');

      return { created: true, purchaseId: purchase.id };
    } catch (error) {
      logger.error('Failed to create purchase', {
        requestId: this.requestId,
        buyerId: data.buyerId,
        promptId: data.promptId,
      }, error as Error, 'PURCHASE_CREATION_FAILED');
      
      throw error;
    }
  }

  /**
   * Create payout record with proper validation
   */
  async createPayout(supabase: any, data: PayoutCreationData): Promise<{ created: boolean; payoutId?: string }> {
    try {
      // Check if payout already exists
      const { data: existing, error: checkError } = await supabase
        .from('payouts')
        .select('id')
        .eq('stripe_transfer_id', data.stripeTransferId)
        .maybeSingle();

      if (checkError) {
        throw new AppError('DATABASE_ERROR', 'Failed to check existing payout', 500, {
          details: checkError.message
        });
      }

      if (existing) {
        logger.info('Payout already exists, skipping creation', {
          requestId: this.requestId,
          payoutId: existing.id,
          stripeTransferId: data.stripeTransferId,
        }, 'PAYOUT_ALREADY_EXISTS');

        return { created: false, payoutId: existing.id };
      }

      // Create new payout
      const payoutData = {
        seller_id: data.sellerId,
        amount: data.amount,
        currency: data.currency,
        stripe_transfer_id: data.stripeTransferId,
        destination_account: data.destinationAccount,
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      const { data: payout, error: insertError } = await supabase
        .from('payouts')
        .insert(payoutData)
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          logger.warn('Payout creation race condition detected', {
            requestId: this.requestId,
            stripeTransferId: data.stripeTransferId,
          }, 'PAYOUT_RACE_CONDITION');

          return { created: false };
        }

        throw new AppError('DATABASE_ERROR', 'Failed to create payout', 500, {
          details: insertError.message
        });
      }

      logger.info('Payout created successfully', {
        requestId: this.requestId,
        payoutId: payout.id,
        sellerId: data.sellerId,
        amount: data.amount,
        stripeTransferId: data.stripeTransferId,
      }, 'PAYOUT_CREATED');

      return { created: true, payoutId: payout.id };
    } catch (error) {
      logger.error('Failed to create payout', {
        requestId: this.requestId,
        stripeTransferId: data.stripeTransferId,
      }, error as Error, 'PAYOUT_CREATION_FAILED');
      
      throw error;
    }
  }

  /**
   * Extract and validate metadata from Stripe objects
   */
  static extractMetadata(metadata: Stripe.Metadata | null | undefined, keys: string[]): string | null {
    if (!metadata) return null;
    
    for (const key of keys) {
      const value = metadata[key];
      if (value) return value;
    }
    
    return null;
  }

  /**
   * Validate required metadata for purchases
   */
  static validatePurchaseMetadata(session: Stripe.Checkout.Session): {
    promptId: string;
    buyerId: string;
    sellerId?: string;
  } {
    const promptId = this.extractMetadata(session.metadata, ['prompt_id', 'promptId']);
    const buyerId = this.extractMetadata(session.metadata, ['user_id', 'buyer_id', 'buyerId', 'userId']);
    const sellerId = this.extractMetadata(session.metadata, ['seller_id', 'sellerId']);

    if (!promptId) {
      throw new AppError('INVALID_METADATA', 'Missing prompt_id in checkout session metadata', 400, {
        metadata: session.metadata
      });
    }

    if (!buyerId) {
      throw new AppError('INVALID_METADATA', 'Missing buyer_id in checkout session metadata', 400, {
        metadata: session.metadata
      });
    }

    return { promptId, buyerId, sellerId: sellerId || undefined };
  }

  /**
   * Validate required metadata for transfers
   */
  static validateTransferMetadata(transfer: Stripe.Transfer): {
    sellerId?: string;
    accountId: string;
  } {
    const sellerId = this.extractMetadata(transfer.metadata, ['seller_id', 'user_id', 'owner_id', 'creator_id']);
    const accountId = typeof transfer.destination === 'string' 
      ? transfer.destination 
      : transfer.destination?.id ?? null;

    if (!accountId) {
      throw new AppError('INVALID_METADATA', 'Missing destination account in transfer', 400, {
        transferId: transfer.id
      });
    }

    return { sellerId: sellerId || undefined, accountId };
  }

  /**
   * Convert cents to dollars
   */
  static centsToDollars(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    return Number((value / 100).toFixed(2));
  }

  /**
   * Hash payload for audit trail
   */
  private async hashPayload(payload: any): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Log business events
   */
  private async logBusinessEvent(eventType: string, data: any): Promise<void> {
    try {
      await BusinessEventLogger.logStripeWebhook(
        eventType,
        this.requestId,
        'success'
      );
    } catch (error) {
      logger.error('Failed to log business event', {
        requestId: this.requestId,
        eventType,
      }, error as Error, 'BUSINESS_EVENT_LOG_FAILED');
    }
  }
}
