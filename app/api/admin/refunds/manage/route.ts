
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, getCurrentUser } from '@/lib/supabase/server';
import { adminRefundActionSchema } from '@/lib/validation/schemas';
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createAuthErrorResponse,
  createForbiddenErrorResponse,
  createNotFoundErrorResponse,
  createServerErrorResponse,
  ErrorCodes,
} from '@/lib/api/responses';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(createAuthErrorResponse(), { status: 401 });
    }

    // Check if user is admin
    if (!user.app_metadata?.role || user.app_metadata.role !== 'admin') {
      return NextResponse.json(createForbiddenErrorResponse(), { status: 403 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid JSON in request body'
      ), { status: 400 });
    }

    // Validate input using Zod schema
    const validationResult = adminRefundActionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const { refund_request_id: refundRequestId, action, reason, partial_amount } = validationResult.data;

    // Initialize Supabase client
    const supabase = await createSupabaseAdminClient();

    // Get refund request with purchase details
    const { data: refundRequest, error: fetchError } = await supabase
      .from('refund_requests')
      .select(`
        *,
        purchases!inner (
          id,
          buyer_id,
          seller_id,
          prompt_id,
          amount_total,
          currency,
          status,
          refunded_amount,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          prompts (title)
        )
      `)
      .eq('id', refundRequestId)
      .single();

    if (fetchError || !refundRequest) {
      return NextResponse.json(createNotFoundErrorResponse('Refund request'), { status: 404 });
    }

    // Check if refund request is still pending
    if (refundRequest.status !== 'open') {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.INVALID_STATUS,
        'Refund request is no longer open'
      ), { status: 400 });
    }

    const purchase = refundRequest.purchases;
    
    // Determine refund amount (cents)
    const totalAmountCents = Number(purchase.amount_total ?? 0);
    const alreadyRefundedCents = Number(purchase.refunded_amount ?? 0);
    const refundableCents = Math.max(0, totalAmountCents - alreadyRefundedCents);

    if (refundableCents <= 0) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.INVALID_STATUS,
        'No refundable amount remaining'
      ), { status: 409 });
    }

    let refundAmountCents = refundableCents;
    if (action === 'partial' && partial_amount) {
      const partialCents = Math.round(partial_amount * 100);
      if (partialCents > refundableCents) {
        return NextResponse.json(createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Partial amount exceeds refundable amount'
        ), { status: 400 });
      }
      refundAmountCents = partialCents;
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-04-10',
    });

    let stripeRefund: Stripe.Refund | null = null;
    let refundStatus = 'failed';

    try {
      // Process refund through Stripe (payment intent preferred)
      let paymentIntentId = purchase.stripe_payment_intent_id;

      if (!paymentIntentId && purchase.stripe_checkout_session_id) {
        const session = await stripe.checkout.sessions.retrieve(purchase.stripe_checkout_session_id);
        paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;
      }

      if (!paymentIntentId) {
        throw new Error('No Stripe payment method found for this purchase');
      }

      stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: refundAmountCents,
        reason: 'requested_by_customer',
        metadata: {
          purchase_id: purchase.id,
          refund_request_id: refundRequestId,
          admin_id: user.id,
          reason: reason,
        },
      });

      refundStatus = stripeRefund.status || 'pending';
      console.log('Stripe refund created successfully:', {
        refundRequestId,
        stripeRefundId: stripeRefund.id,
        amount: refundAmountCents / 100,
        status: refundStatus
      });

    } catch (stripeError: any) {
      console.error('Stripe refund failed:', {
        refundRequestId,
        adminId: user.id,
        error: stripeError.message,
        type: stripeError.type
      });

      return NextResponse.json(createErrorResponse(
        ErrorCodes.EXTERNAL_SERVICE_ERROR,
        'Failed to process refund with payment processor',
        stripeError.message
      ), { status: 400 });
    }

    // Update refund request status
    const { error: updateError } = await supabase
      .from('refund_requests')
      .update({
        status: action === 'approve' || action === 'partial' ? 'approved' : 'denied',
        admin_id: user.id,
        processed_at: new Date().toISOString(),
        admin_reason: reason,
        stripe_refund_id: stripeRefund?.id,
        final_amount: refundAmountCents
      })
      .eq('id', refundRequestId);

    if (updateError) {
      console.error('Failed to update refund request:', {
        refundRequestId,
        adminId: user.id,
        error: updateError.message
      });

      // If Stripe refund was created but DB update failed, attempt to cancel it
      if (stripeRefund && stripeRefund.status === 'pending') {
        try {
          await stripe.refunds.cancel(stripeRefund.id);
          console.log('Cancelled Stripe refund due to DB update failure:', {
            refundRequestId,
            stripeRefundId: stripeRefund.id
          });
        } catch (cancelError) {
          console.error('Failed to cancel Stripe refund:', {
            refundRequestId,
            stripeRefundId: stripeRefund.id,
            error: cancelError
          });
        }
      }

      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update refund request'
      ), { status: 500 });
    }

    // Create refund record
    if (stripeRefund) {
      const { error: refundInsertError } = await supabase
        .from('refunds')
        .insert({
          purchase_id: purchase.id,
          stripe_refund_id: stripeRefund.id,
          amount: refundAmountCents,
          currency: purchase.currency,
          reason: reason,
          status: refundStatus,
          stripe_created_at: new Date(stripeRefund.created * 1000).toISOString(),
          last_stripe_event_id: stripeRefund.id
        });

      if (refundInsertError) {
        console.error('Failed to create refund record:', {
          purchaseId: purchase.id,
          stripeRefundId: stripeRefund.id,
          error: refundInsertError.message
        });
      }
    }

    console.log('Refund action completed successfully:', {
      refundRequestId,
      action,
      adminId: user.id,
      amount: refundAmountCents / 100,
      stripeRefundId: stripeRefund?.id,
      status: refundStatus
    });

    // Return success response
    return NextResponse.json(createSuccessResponse({
      refundRequest: {
        id: refundRequestId,
        status: action === 'approve' || action === 'partial' ? 'approved' : 'rejected',
        processedAt: new Date().toISOString(),
        finalAmount: refundAmount,
        stripeRefundId: stripeRefund?.id,
        stripeStatus: refundStatus
      }
    }, 'Refund action completed successfully'));

  } catch (error: any) {
    console.error('Unexpected error in refund action:', error);
    return NextResponse.json(createServerErrorResponse(error));
  }
}

// GET endpoint to list pending refund requests
export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json(createForbiddenErrorResponse(), { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'open';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Initialize Supabase client
    const supabase = await createSupabaseServerClient();

    // Get refund requests
    const { data: refundRequests, error } = await supabase
      .from('refund_requests')
      .select(`
        *,
        purchases!inner (
          id,
          buyer_id,
          seller_id,
          prompt_id,
          amount_total,
          currency,
          status,
          refunded_amount,
          created_at,
          prompts (title)
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch refund requests for admin:', {
        adminId: user.id,
        status,
        error: error.message
      });
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch refund requests'
      ), { status: 500 });
    }

    console.log('Admin refund requests fetched successfully:', {
      adminId: user.id,
      status,
      count: refundRequests?.length || 0
    });

    const normalized = (refundRequests || []).map((r: any) => ({
      ...r,
      requested_amount: r.requested_amount != null ? r.requested_amount / 100 : null,
      final_amount: r.final_amount != null ? r.final_amount / 100 : null,
      purchases: r.purchases
        ? {
            ...r.purchases,
            amount_total: r.purchases.amount_total != null ? r.purchases.amount_total / 100 : null,
            refunded_amount: r.purchases.refunded_amount != null ? r.purchases.refunded_amount / 100 : null,
          }
        : null,
    }));

    return NextResponse.json(createSuccessResponse({
      refundRequests: normalized,
      status,
      limit,
      offset
    }));

  } catch (error: any) {
    console.error('Unexpected error in admin refund requests fetch:', error);
    return NextResponse.json(createServerErrorResponse(error));
  }
}
