import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { AppError, ErrorCategory } from '@/lib/errors';
import { createSupabaseMock } from './test-utils/mockSupabase';
let webhookModule: any;

let POST: any;
let supabaseMockRef: any;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: vi.fn(() => Promise.resolve(supabaseMockRef)),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  businessLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    webhookReceived: vi.fn(),
    webhookProcessed: vi.fn(),
  },
}));

vi.mock('@/lib/middleware/api-handler', () => ({
  BusinessEventLogger: {
    logStripeWebhook: vi.fn(),
    logPurchaseEvent: vi.fn(),
  },
}));

beforeAll(async () => {
  webhookModule = await import('@/app/api/stripe/webhook/route');
  ({ POST } = webhookModule);
});

beforeEach(() => {
  vi.restoreAllMocks();
  supabaseMockRef = undefined;
  webhookModule?.setWebhookHandler?.(null);
});

async function runWebhook(event: any, supabaseSeed: any = {}, reuseExisting = false) {
  if (!reuseExisting) {
    supabaseMockRef = createSupabaseMock(supabaseSeed);
  }
  const handlerMock = { verifySignature: vi.fn().mockReturnValue(event as any) };
  webhookModule.setWebhookHandler(handlerMock as any);
  const req = new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'stripe-signature': 't' },
  });
  const res = await POST(req as any);
  return res;
}

describe('Stripe webhook route', () => {
  it('returns 400 on signature failure', async () => {
    supabaseMockRef = createSupabaseMock();
    const handlerMock = { verifySignature: vi.fn() };
    webhookModule.setWebhookHandler(handlerMock as any);
    handlerMock.verifySignature.mockImplementation(() => {
      throw new AppError(ErrorCategory.AUTH, 'INVALID_STRIPE_SIGNATURE', 'bad sig', {}, 400);
    });
    const req = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'stripe-signature': 't' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(supabaseMockRef.data.stripe_events).toHaveLength(0);
  });

  it('is idempotent for duplicate events', async () => {
    const event = {
      id: 'evt_dup',
      type: 'checkout.session.completed',
      created: 111,
      livemode: false,
      data: {
        object: {
          id: 'cs_1',
          payment_intent: 'pi_dup',
          amount_total: 500,
          currency: 'usd',
          metadata: {
            prompt_id: 'prompt1',
            buyer_id: 'buyer1',
            seller_id: 'seller1',
          },
        },
      },
    };

    const supabaseSeed = {
      prompts: [{ id: 'prompt1', user_id: 'seller1', price: 5 }],
    };

    const first = await runWebhook(event, supabaseSeed);
    if (first.status !== 200) {
      const body = await first.json();
      console.error('first webhook response', body);
      console.error('supabase snapshot', JSON.stringify(supabaseMockRef?.data, null, 2));
      const logger = await import('@/lib/logging');
      console.error('logger.error calls', logger.logger.error.mock.calls);
    }
    expect(first.status).toBe(200);
    expect(supabaseMockRef.data.purchases).toHaveLength(1);
    expect(supabaseMockRef.data.purchases[0].status).toBe('paid');
    expect(supabaseMockRef.data.stripe_events[0].processed_at).toBeDefined();

    const second = await runWebhook(event, supabaseSeed, true);
    const payload = await second.json();
    expect(second.status).toBe(200);
    expect(payload.duplicate).toBe(true);
    expect(supabaseMockRef.data.purchases).toHaveLength(1);
  });

  it('handles checkout.session.completed to paid', async () => {
    const event = {
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      created: 222,
      livemode: false,
      data: {
        object: {
          id: 'cs_2',
          payment_intent: 'pi_checkout',
          amount_total: 900,
          currency: 'usd',
          metadata: {
            prompt_id: 'promptA',
            buyer_id: 'buyerA',
            seller_id: 'sellerA',
          },
        },
      },
    };

    await runWebhook(event, { prompts: [{ id: 'promptA', user_id: 'sellerA', price: 9 }] });

    const purchase = supabaseMockRef.data.purchases[0];
    expect(purchase.stripe_checkout_session_id).toBe('cs_2');
    expect(purchase.status).toBe('paid');
    expect(purchase.amount_total).toBe(900);
  });

  it('handles full refunds', async () => {
    const event = {
      id: 'evt_refund_full',
      type: 'charge.refunded',
      created: 333,
      data: {
        object: {
          object: 'charge',
          payment_intent: 'pi_full',
          amount_refunded: 1000,
          amount: 1000,
          currency: 'usd',
          metadata: {},
          refunds: { data: [] },
        },
      },
    };

    await runWebhook(event, {
      purchases: [
        {
          id: 'pur1',
          buyer_id: 'buyer1',
          seller_id: 'seller1',
          prompt_id: 'promptX',
          amount_total: 1000,
          refunded_amount: 0,
          status: 'paid',
          currency: 'usd',
          stripe_payment_intent_id: 'pi_full',
        },
      ],
    });

    const purchase = supabaseMockRef.data.purchases[0];
    expect(purchase.refunded_amount).toBe(1000);
    expect(purchase.status).toBe('refunded');
  });

  it('handles partial refunds', async () => {
    const event = {
      id: 'evt_refund_partial',
      type: 'charge.refunded',
      created: 444,
      data: {
        object: {
          object: 'charge',
          payment_intent: 'pi_partial',
          amount_refunded: 400,
          amount: 1000,
          currency: 'usd',
          metadata: {},
          refunds: { data: [] },
        },
      },
    };

    await runWebhook(event, {
      purchases: [
        {
          id: 'pur2',
          buyer_id: 'buyer2',
          seller_id: 'seller2',
          prompt_id: 'promptY',
          amount_total: 1000,
          refunded_amount: 0,
          status: 'paid',
          currency: 'usd',
          stripe_payment_intent_id: 'pi_partial',
        },
      ],
    });

    const purchase = supabaseMockRef.data.purchases[0];
    expect(purchase.refunded_amount).toBe(400);
    expect(purchase.status).toBe('partially_refunded');
  });

  it('marks disputes', async () => {
    const event = {
      id: 'evt_dispute',
      type: 'charge.dispute.created',
      created: 555,
      data: {
        object: {
          payment_intent: 'pi_dispute',
          charge: 'ch_1',
        },
      },
    };

    await runWebhook(event, {
      purchases: [
        {
          id: 'pur3',
          buyer_id: 'buyer3',
          seller_id: 'seller3',
          prompt_id: 'promptZ',
          amount_total: 700,
          refunded_amount: 0,
          status: 'paid',
          currency: 'usd',
          stripe_payment_intent_id: 'pi_dispute',
        },
      ],
    });

    const purchase = supabaseMockRef.data.purchases[0];
    expect(purchase.status).toBe('disputed');
  });
});
