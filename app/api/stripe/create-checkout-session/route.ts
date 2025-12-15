
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createCheckoutSessionSchema } from '@/lib/validation/schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse, 
  createAuthErrorResponse, 
  createNotFoundErrorResponse,
  createServerErrorResponse,
  ErrorCodes 
} from '@/lib/api/responses';

export const runtime = "nodejs";

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return null;
  }
  return new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' });
}

export async function POST(req: Request) {
  try {
    // Get current user (optional for checkout)
    const user = await getCurrentUser();
    
    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.SERVER_ERROR,
        "Server misconfigured: STRIPE_SECRET_KEY is missing"
      ), { status: 500 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid JSON in request body'
      ), { status: 400 });
    }

    // Validate input using Zod schema
    const validationResult = createCheckoutSessionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const { prompt_id: promptId, success_url, cancel_url } = validationResult.data;
    const priceInCents = Number(body?.price);

    // Validate required fields from original code
    const title = body?.title;
    if (!promptId || !title || !Number.isFinite(priceInCents) || priceInCents <= 0) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Missing or invalid prompt_id, title, or price'
      ), { status: 400 });
    }

    // Verify prompt exists and get details
    const supabase = await createSupabaseServerClient();
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, title, user_id')
      .eq('id', promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json(createNotFoundErrorResponse('Prompt'), { status: 404 });
    }

    // Verify user owns the prompt or get seller info
    const sellerId = prompt.user_id;
    if (user && user.id === sellerId) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Cannot purchase your own prompt'
      ), { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    // Create a one-time payment session using inline price_data
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: priceInCents,
            product_data: {
              name: title,
              metadata: {
                prompt_id: promptId,
              },
            },
          },
          quantity: 1,
        },
      ],
      success_url: success_url || `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${siteUrl}/cancel`,
      metadata: {
        prompt_id: promptId,
        seller_id: sellerId,
        user_id: user?.id ?? "",
      },
    });

    // Return success response
    return NextResponse.json(createSuccessResponse({
      url: session.url,
      sessionId: session.id
    }, 'Checkout session created successfully'));

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Payment method error',
        error.message
      ), { status: 400 });
    }
    
    if (error.type === 'StripeRateLimitError') {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Too many requests - please try again later'
      ), { status: 429 });
    }
    
    if (error.type?.startsWith('Stripe')) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.EXTERNAL_SERVICE_ERROR,
        'Payment processor error',
        error.message
      ), { status: 502 });
    }

    return NextResponse.json(createServerErrorResponse(error));
  }
}
