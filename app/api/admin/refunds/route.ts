import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { adminRefundInitiateSchema } from '@/lib/validation/schemas';
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api/responses';
import { logger } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProfileRow = { is_admin?: boolean | null };

function getToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

async function assertAdmin(req: NextRequest, supabaseAdmin: Awaited<ReturnType<typeof createSupabaseAdminClient>>) {
  const token = getToken(req);
  if (!token) {
    return { status: 401, message: 'Authentication required' };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || !userId) {
    return { status: 401, message: 'Invalid auth token' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    return { status: 500, message: 'Failed to load admin profile' };
  }

  if (!profile?.is_admin) {
    return { status: 403, message: 'Forbidden' };
  }

  return { status: 200, userId };
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const supabaseAdmin = await createSupabaseAdminClient();

    const adminCheck = await assertAdmin(req, supabaseAdmin);
    if (adminCheck.status !== 200) {
      return NextResponse.json(
        createErrorResponse(
          adminCheck.status === 403 ? ErrorCodes.FORBIDDEN : ErrorCodes.UNAUTHORIZED,
          adminCheck.message || 'Unauthorized'
        ),
        { status: adminCheck.status }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_JSON, 'Invalid JSON in request body'),
        { status: 400 }
      );
    }

    const parsed = adminRefundInitiateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid request data', parsed.error.format()),
        { status: 400 }
      );
    }

    const { purchaseId, amount, reason } = parsed.data;

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .select(
        'id,status,amount_total,refunded_amount,currency,stripe_payment_intent_id,stripe_checkout_session_id,buyer_id,seller_id'
      )
      .eq('id', purchaseId)
      .maybeSingle();

    if (purchaseError || !purchase) {
      return NextResponse.json(createErrorResponse(ErrorCodes.NOT_FOUND, 'Purchase not found'), { status: 404 });
    }

    if (purchase.status === 'refunded') {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_STATUS, 'Purchase already fully refunded'),
        { status: 409 }
      );
    }

    if (!['paid', 'partially_refunded'].includes((purchase.status || '').toLowerCase())) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_STATUS,
          'Refunds are only allowed for paid or partially refunded purchases'
        ),
        { status: 400 }
      );
    }

    const amountTotalCents = Number(purchase.amount_total ?? 0);
    const alreadyRefundedCents = Number(purchase.refunded_amount ?? 0);
    const refundableCents = Math.max(0, amountTotalCents - alreadyRefundedCents);

    if (refundableCents <= 0) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_STATUS, 'No refundable amount remaining'),
        { status: 409 }
      );
    }

    const requestedCents = amount ? Math.round(amount * 100) : refundableCents;
    if (requestedCents > refundableCents) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Requested amount exceeds refundable amount'),
        { status: 400 }
      );
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.SERVER_ERROR, 'Stripe is not configured'),
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10' });

    let paymentIntentId = purchase.stripe_payment_intent_id;
    if (!paymentIntentId && purchase.stripe_checkout_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(purchase.stripe_checkout_session_id);
        paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;
      } catch (err: any) {
        logger.warn('Failed to retrieve checkout session for refund', {
          requestId,
          purchaseId,
          sessionId: purchase.stripe_checkout_session_id,
          error: err?.message,
        }, 'REFUND_SESSION_LOOKUP_FAILED');
      }
    }

    if (!paymentIntentId) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_STATUS, 'Payment intent is missing for this purchase'),
        { status: 400 }
      );
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: requestedCents,
      reason: reason ? 'requested_by_customer' : undefined,
      metadata: {
        purchase_id: purchaseId,
        admin_id: adminCheck.userId!,
        reason: reason ?? '',
      },
    });

    const { error: refundRecordError } = await supabaseAdmin.from('refunds').insert({
      purchase_id: purchaseId,
      stripe_refund_id: refund.id,
      amount: requestedCents,
      currency: purchase.currency || 'usd',
      reason: reason ?? null,
      status: refund.status || 'pending',
      stripe_created_at: new Date(refund.created * 1000).toISOString(),
      last_stripe_event_id: refund.id,
    });

    if (refundRecordError) {
      logger.warn('Failed to persist refund record', {
        requestId,
        purchaseId,
        refundId: refund.id,
        error: refundRecordError.message,
      }, 'REFUND_RECORD_FAILED');
    }

    logger.info('Admin initiated refund', {
      requestId,
      adminUserId: adminCheck.userId,
      purchaseId,
      refundId: refund.id,
      amount: requestedCents,
    }, 'ADMIN_REFUND_INITIATED');

    return NextResponse.json(
      createSuccessResponse({
        refundId: refund.id,
        purchaseId,
        amount: requestedCents / 100,
        currency: purchase.currency || 'usd',
      })
    );
  } catch (error: any) {
    logger.error('Admin refund initiation failed', { requestId }, error as Error, 'ADMIN_REFUND_FAILED');
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to initiate refund'),
      { status: 500 }
    );
  }
}
