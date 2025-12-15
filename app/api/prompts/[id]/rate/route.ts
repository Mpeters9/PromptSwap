import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient, getCurrentUser } from '@/lib/supabase/server';
import { ratePromptSchema } from '@/lib/validation/schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse, 
  createAuthErrorResponse, 
  createNotFoundErrorResponse,
  ErrorCodes 
} from '@/lib/api/responses';
import { enforceRateLimit, rateLimitResponse, RateLimitExceeded } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
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
    const validationResult = ratePromptSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const { rating, comment } = validationResult.data;
    const promptId = params.id;

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Check if prompt exists
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, status, user_id, price')
      .eq('id', promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json(createNotFoundErrorResponse('Prompt'), { status: 404 });
    }

    if (prompt?.status !== 'approved') {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_STATUS, 'Prompt is not available for rating'),
        { status: 400 }
      );
    }

    const supabaseAdmin = await createSupabaseAdminClient();
    try {
      await enforceRateLimit({
        request: req,
        supabase: supabaseAdmin,
        scope: 'prompt:rate',
        limit: 5,
        windowSeconds: 60,
        userId: user.id,
      });
    } catch (err) {
      if (err instanceof RateLimitExceeded) {
        return rateLimitResponse(err);
      }
      throw err;
    }

    // Check if user already rated this prompt
    const { data: existingRating } = await supabase
      .from('prompt_ratings')
      .select('id')
      .eq('prompt_id', promptId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingRating) {
      // Update existing rating
      const { error: updateError } = await supabase
        .from('prompt_ratings')
        .update({
          rating,
          comment: comment || null,
        })
        .eq('prompt_id', promptId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating rating:', updateError);
        return NextResponse.json(createErrorResponse(
          ErrorCodes.DATABASE_ERROR,
          'Failed to update rating'
        ), { status: 500 });
      }
    } else {
      // Create new rating
      const { error: insertError } = await supabase
        .from('prompt_ratings')
        .insert({
          prompt_id: promptId,
          user_id: user.id,
          rating,
          comment: comment || null,
        });

      if (insertError) {
        console.error('Error inserting rating:', insertError);
        return NextResponse.json(createErrorResponse(
          ErrorCodes.DATABASE_ERROR,
          'Failed to submit rating'
        ), { status: 500 });
      }
    }

    // Recompute average rating
    const { data: agg, error: aggError } = await supabase
      .from('prompt_ratings')
      .select('rating')
      .eq('prompt_id', promptId);

    if (aggError) {
      console.error('Error calculating average rating:', aggError);
    }

    let average = 0;
    if (agg && agg.length > 0) {
      const totalRating = agg.reduce((sum, item) => sum + item.rating, 0);
      average = Math.round((totalRating / agg.length) * 10) / 10; // Round to 1 decimal place
    }

    // Update prompt average rating (best effort)
    try {
      await supabase
        .from('prompts')
        .update({ average_rating: average })
        .eq('id', promptId);
    } catch (updateError) {
      // Ignore if average_rating column doesn't exist
      console.warn('Could not update prompt average_rating:', updateError);
    }

    // Return success response
    return NextResponse.json(createSuccessResponse({
      rating,
      average,
      promptId,
    }, 'Rating submitted successfully'));

  } catch (error) {
    console.error('Unexpected error in rating submission:', error);
    return NextResponse.json(createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    ), { status: 500 });
  }
}
