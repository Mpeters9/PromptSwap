import { NextResponse } from 'next/server';
import { createPromptSchema } from '@/lib/validation/schemas';
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, createAuthErrorResponse, ErrorCodes } from '@/lib/api/responses';
import { getCurrentUser, createSupabaseAdminClient } from '@/lib/supabase/server';
import { enforceRateLimit, rateLimitResponse, RateLimitExceeded } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(createAuthErrorResponse(), { status: 401 });
    }

    const supabaseAdmin = await createSupabaseAdminClient();

    try {
      await enforceRateLimit({
        request: req,
        supabase: supabaseAdmin,
        scope: 'prompt:create',
        limit: 5,
        windowSeconds: 60,
        userId: user.id,
        requestId,
      });
    } catch (err) {
      if (err instanceof RateLimitExceeded) {
        return rateLimitResponse(err);
      }
      throw err;
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid JSON in request body'),
        { status: 400 }
      );
    }

    const validationResult = createPromptSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const { title, description, category, price, prompt_text, tags, preview_image, version, status } =
      validationResult.data;

    const { data, error } = await supabaseAdmin
      .from('prompts')
      .insert({
        user_id: user.id,
        title,
        description,
        category,
        price,
        prompt_text,
        tags,
        preview_image,
        is_public: false,
        version,
        status,
        moderation_note: null,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Failed to insert prompt', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.DATABASE_ERROR,
          'Failed to create prompt',
          error?.message
        ),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({ promptId: data.id }, 'Prompt submitted for review')
    );
  } catch (error) {
    console.error('Unexpected error creating prompt', error);
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}
