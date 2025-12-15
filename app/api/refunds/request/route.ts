
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { refundRequestSchema } from '@/lib/validation/schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse, 
  createAuthErrorResponse, 
  createNotFoundErrorResponse,
  createServerErrorResponse,
  ErrorCodes 
} from '@/lib/api/responses';

export async function POST(request: NextRequest) {
  try {
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
    const totalAmount = parseFloat(purchase.amount_total);
    const alreadyRefunded = parseFloat(purchase.refunded_amount || 0);
    const refundableAmount = totalAmount - alreadyRefunded;

    if (refundableAmount <= 0) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'No refundable amount available'
      ), { status: 400 });
    }

    // Validate requested amount if provided
    if (requested_amount && requested_amount > refundableAmount) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Requested amount exceeds refundable amount'
      ), { status: 400 });
    }

    // Create refund request record
    const refundRequestData = {
      purchase_id: purchaseId,
      reason,
      requested_amount: requested_amount || refundableAmount,
      status: 'pending',
      user_id: user.id,
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
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create refund request'
      ), { status: 500 });
    }

    // Return success response
    return NextResponse.json(createSuccessResponse({
      refundRequest: {
        id: refundRequest.id,
        purchaseId,
        reason,
        requestedAmount: refundRequestData.requested_amount,
        status: 'pending',
        createdAt: refundRequest.created_at,
        refundableAmount,
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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching refund requests:', error);
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch refund requests'
      ), { status: 500 });
    }

    return NextResponse.json(createSuccessResponse({
      refundRequests: refundRequests || []
    }));

  } catch (error: any) {
    console.error('Unexpected error in refund requests fetch:', error);
    return NextResponse.json(createServerErrorResponse(error));
  }
}
