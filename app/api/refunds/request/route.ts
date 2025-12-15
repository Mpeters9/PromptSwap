
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { refundRequestSchema } from '@/lib/validation/schemas';
import { notifyAdmins } from '@/lib/notifications';
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createAuthErrorResponse,
  createNotFoundErrorResponse,
  createServerErrorResponse,
  ErrorCodes,
} from '@/lib/api/responses';

export async function POST(request: NextRequest) {
  try {
    const requestId = crypto.randomUUID();
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(createAuthErrorResponse(), { status: 401 });
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
    const validationResult = refundRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const { purchase_id: purchaseId, reason, requested_amount } = validationResult.data;

    // Initialize Supabase client
    const supabase = await createSupabaseServerClient();

    // Verify purchase exists and belongs to user
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select(`
        id,
        buyer_id,
        seller_id,
        prompt_id,
        amount_total,
        currency,
        status,
        refunded_amount,
        stripe_checkout_session_id,
        created_at,
        prompts (title)
      `)
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      return NextResponse.json(createNotFoundErrorResponse('Purchase'), { status: 404 });
    }

    // Check if user is the buyer
    if (purchase.buyer_id !== user.id) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only the buyer can request a refund'
      ), { status: 403 });
    }

    // Check if purchase is eligible for refund
    const now = new Date();
    const purchaseDate = new Date(purchase.created_at);
    const daysSincePurchase = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));

    if (purchase.status === 'refunded') {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.INVALID_STATUS,
        'This purchase has already been fully refunded'
      ), { status: 400 });
    }

    if (purchase.status === 'failed') {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.INVALID_STATUS,
        'Cannot refund a failed purchase'
      ), { status: 400 });
    }

    if (daysSincePurchase > 30) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Refund period has expired (30 days)'
      ), { status: 400 });
    }

    // Calculate refundable amount
    const totalAmountCents = Number(purchase.amount_total ?? 0);
    const alreadyRefundedCents = Number(purchase.refunded_amount ?? 0);
    const refundableAmountCents = totalAmountCents - alreadyRefundedCents;

    if (refundableAmountCents <= 0) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'No refundable amount available'
      ), { status: 400 });
    }

    // Validate requested amount if provided
    const requestedAmountCents = requested_amount ? Math.round(requested_amount * 100) : undefined;
    if (requestedAmountCents && requestedAmountCents > refundableAmountCents) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Requested amount exceeds refundable amount'
      ), { status: 400 });
    }

    // Ensure no open request already exists
    const { data: existingRequest, error: existingError } = await supabase
      .from('refund_requests')
      .select('id,status')
      .eq('purchase_id', purchaseId)
      .eq('status', 'open')
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to check refund requests'
      ), { status: 500 });
    }

    if (existingRequest) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.ALREADY_EXISTS,
        'There is already an open refund request for this purchase'
      ), { status: 409 });
    }

    // Create refund request record
    const refundRequestData = {
      purchase_id: purchaseId,
      reason,
      requested_amount: requestedAmountCents ?? refundableAmountCents,
      status: 'open',
      requester_user_id: user.id,
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    };

    const { data: refundRequest, error: insertError } = await supabase
      .from('refund_requests')
      .insert(refundRequestData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating refund request:', insertError);
      const status = insertError.code === '23505' ? 409 : 500;
      return NextResponse.json(createErrorResponse(
        insertError.code === '23505' ? ErrorCodes.ALREADY_EXISTS : ErrorCodes.DATABASE_ERROR,
        insertError.code === '23505'
          ? 'There is already an open refund request for this purchase'
          : 'Failed to create refund request'
      ), { status });
    }

    try {
      const supabaseAdmin = await createSupabaseAdminClient();
      await notifyAdmins(supabaseAdmin, {
        type: 'refund.requested',
        title: 'Refund request submitted',
        body: `A refund was requested for purchase ${purchaseId}.`,
        url: '/admin',
        requestId,
      });
    } catch (notifyError) {
      console.error('Failed to send admin refund notification', notifyError);
    }

    // Return success response
    return NextResponse.json(createSuccessResponse({
      refundRequest: {
        id: refundRequest.id,
        purchaseId,
        reason,
        requestedAmount: (refundRequestData.requested_amount ?? 0) / 100,
        status: 'open',
        createdAt: refundRequest.created_at,
        refundableAmount: refundableAmountCents / 100,
        daysRemaining: Math.max(0, 30 - daysSincePurchase)
      }
    }, 'Refund request created successfully'));

  } catch (error: any) {
    console.error('Unexpected error in refund request:', error);
    return NextResponse.json(createServerErrorResponse(error));
  }
}

// GET endpoint to retrieve user's refund requests
export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(createAuthErrorResponse(), { status: 401 });
    }

    // Initialize Supabase client
    const supabase = await createSupabaseServerClient();

    // Get refund requests for user's purchases
    const { data: refundRequests, error } = await supabase
      .from('refund_requests')
      .select(`
        *,
        purchases (
          id,
          amount_total,
          currency,
          status,
          refunded_amount,
          prompts (title)
        )
      `)
      .eq('requester_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching refund requests:', error);
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch refund requests'
      ), { status: 500 });
    }

    const normalized = (refundRequests || []).map((r: any) => ({
      ...r,
      requested_amount: r.requested_amount != null ? r.requested_amount / 100 : null,
      purchases: r.purchases
        ? {
            ...r.purchases,
            amount_total: r.purchases.amount_total != null ? r.purchases.amount_total / 100 : null,
            refunded_amount: r.purchases.refunded_amount != null ? r.purchases.refunded_amount / 100 : null,
          }
        : null,
    }));

    return NextResponse.json(createSuccessResponse({
      refundRequests: normalized
    }));

  } catch (error: any) {
    console.error('Unexpected error in refund requests fetch:', error);
    return NextResponse.json(createServerErrorResponse(error));
  }
}
