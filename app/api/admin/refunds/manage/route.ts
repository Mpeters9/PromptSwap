
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { adminRefundActionSchema } from '@/lib/validation/schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse, 
  createAuthErrorResponse, 
  createForbiddenErrorResponse,
  createNotFoundErrorResponse,
  createServerErrorResponse,
  ErrorCodes 
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
    const supabase = await createSupabaseServerClient();

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
    if (refundRequest.status !== 'pending') {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.INVALID_STATUS,
        'Refund request is no longer pending'
      ), { status: 400 });
    }

    const purchase = refundRequest.purchases;
    
    // Determine refund amount
    let refundAmount: number;
    if (action === 'partial' && partial_amount) {
      const totalAmount = parseFloat(purchase.amount_total);
      const alreadyRefunded = parseFloat(purchase.refunded_amount || 0);
      const refundableAmount = totalAmount - alreadyRefunded;

      if (partial_amount > refundableAmount) {
        return NextResponse.json(createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Partial amount exceeds refundable amount'
        ), { status: 400 });
      }
      refundAmount = partial_amount;
    } else {
      const totalAmount = parseFloat(purchase.amount_total);
      const alreadyRefunded = parseFloat(purchase.refunded_amount || 0);
      refundAmount = totalAmount - alreadyRefunded;
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-04-10',
    });

    let stripeRefund: Stripe.Refund | null = null;
    let refundStatus = 'failed';

    try {
      // Process refund through Stripe
      if (purchase.stripe_payment_intent_id) {
        // Use Payment Intent for refunds
        stripeRefund = await stripe.refunds.create({
          payment_intent: purchase.stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100), // Convert to cents
          reason: 'requested_by_customer',
          metadata: {
            purchase_id: purchase.id,
            refund_request_id: refundRequestId,
            admin_id: user.id,
            reason: reason,
          },
        });
      } else if (purchase.stripe_checkout_session_id) {
        // Fallback to using checkout session
        stripeRefund = await stripe.refunds.create({
          payment_intent: purchase.stripe_checkout_session_id,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
          metadata: {
            purchase_id: purchase.id,
            refund_request_id: refundRequestId,
            admin_id: user.id,
            reason: reason,
          },
        });
      } else {
        throw new Error('No Stripe payment method found for this purchase');
      }

      refundStatus = stripeRefund.status || 'pending';
      console.log('Stripe refund created successfully:', {
        refundRequestId,
        stripeRefundId: stripeRefund.id,
        amount: refundAmount,
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
        status: action === 'approve' || action === 'partial' ? 'approved' : 'rejected',
        admin_id: user.id,
        processed_at: new Date().toISOString(),
        admin_reason: reason,
        stripe_refund_id: stripeRefund?.id,
        final_amount: refundAmount
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
          amount: refundAmount,
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

    // Update purchase record if refund is completed
    if (refundStatus === 'succeeded') {
      const currentRefunded = parseFloat(purchase.refunded_amount || 0);
      const newRefundedAmount = currentRefunded + refundAmount;
      const totalAmount = parseFloat(purchase.amount_total);

      let purchaseStatus = purchase.status;
      if (newRefundedAmount >= totalAmount) {
        purchaseStatus = 'refunded';
      } else if (newRefundedAmount > 0) {
        purchaseStatus = 'partially_refunded';
      }

      const { error: purchaseUpdateError } = await supabase
        .from('purchases')
        .update({
          refunded_amount: newRefundedAmount,
          refunded_at: newRefundedAmount > 0 ? new Date().toISOString() : null,
          refund_reason: newRefundedAmount > 0 ? reason : null,
          status: purchaseStatus,
          last_stripe_event_id: stripeRefund?.id
        })
        .eq('id', purchase.id);

      if (purchaseUpdateError) {
        console.error('Failed to update purchase after refund:', {
          purchaseId: purchase.id,
          error: purchaseUpdateError.message
        });
      }
    }

    console.log('Refund action completed successfully:', {
      refundRequestId,
      action,
      adminId: user.id,
      amount: refundAmount,
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
    const status = searchParams.get('status') || 'pending';
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

    return NextResponse.json(createSuccessResponse({ 
      refundRequests: refundRequests || [],
      status,
      limit,
      offset
    }));

  } catch (error: any) {
    console.error('Unexpected error in admin refund requests fetch:', error);
    return NextResponse.json(createServerErrorResponse(error));
  }
}

