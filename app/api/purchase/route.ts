import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { purchaseSchema } from '@/lib/validation/schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse, 
  createAuthErrorResponse, 
  createNotFoundErrorResponse,
  ErrorCodes 
} from '@/lib/api/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const rateLimitWindowMs = 60_000;
const rateLimitMax = 10;
const purchaseLimiter = new Map<string, { ts: number; count: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const current = purchaseLimiter.get(key);
  if (!current || now - current.ts > rateLimitWindowMs) {
    purchaseLimiter.set(key, { ts: now, count: 1 });
    return false;
  }
  if (current.count >= rateLimitMax) return true;
  current.count += 1;
  return false;
}

export async function POST(req: Request) {
  try {
    // Rate limiting
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown';
    if (rateLimit(ip)) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Rate limit exceeded'
      ), { status: 429 });
    }

    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(createAuthErrorResponse(), { status: 401 });
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
    const validationResult = purchaseSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const { prompt_id: promptId } = validationResult.data;

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Get prompt details
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, title, price, user_id, prompt_text')
      .eq('id', promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json(createNotFoundErrorResponse('Prompt'), { status: 404 });
    }

    if (prompt.user_id === user.id) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Cannot purchase your own prompt'
      ), { status: 400 });
    }

    // Check if already purchased
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('prompt_id', prompt.id)
      .maybeSingle();

    if (existingPurchase) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.ALREADY_EXISTS,
        'You already own this prompt'
      ), { status: 400 });
    }

    const price = Math.round(Number(prompt.price ?? 0));

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid prompt price'
      ), { status: 400 });
    }

    // Get buyer profile
    const { data: buyerProfile, error: buyerProfileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (buyerProfileError || !buyerProfile) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to load buyer profile'
      ), { status: 500 });
    }

    const buyerCredits = Number(buyerProfile.credits ?? 0);

    if (buyerCredits < price) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.INSUFFICIENT_FUNDS,
        'Insufficient credits to purchase this prompt'
      ), { status: 400 });
    }

    // Get seller profile
    const { data: sellerProfile, error: sellerProfileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', prompt.user_id)
      .single();

    if (sellerProfileError || !sellerProfile) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to load seller profile'
      ), { status: 500 });
    }

    const sellerCredits = Number(sellerProfile.credits ?? 0);

    // Update buyer credits with optimistic locking
    const { data: buyerUpdate, error: buyerUpdateError } = await supabase
      .from('profiles')
      .update({ credits: buyerCredits - price })
      .eq('id', user.id)
      .eq('credits', buyerCredits)
      .select('credits')
      .single();

    if (buyerUpdateError || !buyerUpdate) {
      const insufficient = buyerUpdateError?.code === '23514' || buyerUpdateError?.code === '23505';
      return NextResponse.json(createErrorResponse(
        insufficient ? ErrorCodes.INSUFFICIENT_FUNDS : ErrorCodes.DATABASE_ERROR,
        insufficient ? 'Insufficient credits' : 'Failed to update buyer credits'
      ), { status: 400 });
    }

    // Update seller credits
    const { data: sellerUpdate, error: sellerUpdateError } = await supabase
      .from('profiles')
      .update({ credits: sellerCredits + price })
      .eq('id', prompt.user_id)
      .eq('credits', sellerCredits)
      .select('credits')
      .single();

    if (sellerUpdateError || !sellerUpdate) {
      // Rollback buyer update
      await supabase
        .from('profiles')
        .update({ credits: buyerCredits })
        .eq('id', user.id);
      
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update seller credits'
      ), { status: 500 });
    }

    // Create purchase record
    const { error: insertError } = await supabase
      .from('purchases')
      .insert({
        buyer_id: user.id,
        seller_id: prompt.user_id,
        prompt_id: prompt.id,
        price,
      });

    if (insertError) {
      // Rollback both updates
      await supabase.from('profiles').update({ credits: buyerCredits }).eq('id', user.id);
      await supabase.from('profiles').update({ credits: sellerCredits }).eq('id', prompt.user_id);

      if (insertError.code === '23505') {
        return NextResponse.json(createErrorResponse(
          ErrorCodes.ALREADY_EXISTS,
          'Purchase already exists'
        ), { status: 400 });
      }

      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create purchase record'
      ), { status: 500 });
    }

    // Return success response with prompt content
    return NextResponse.json(createSuccessResponse({
      content: prompt.prompt_text,
      purchase: {
        promptId: prompt.id,
        title: prompt.title,
        price: price,
      }
    }, 'Prompt purchased successfully'));

  } catch (error) {
    console.error('Unexpected error in purchase:', error);
    return NextResponse.json(createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    ), { status: 500 });
  }
}

