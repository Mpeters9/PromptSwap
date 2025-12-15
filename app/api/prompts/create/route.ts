import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createPromptSchema } from '@/lib/validation/schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse, 
  createAuthErrorResponse, 
  ErrorCodes 
} from '@/lib/api/responses';

export const runtime = 'nodejs';

export async function POST(req: Request) {
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
    const validationResult = createPromptSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Insert the prompt
    const { data, error: insertError } = await supabase
      .from('prompts')
      .insert({
        user_id: user.id,
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        price: validatedData.price,
        prompt_text: validatedData.prompt_text,
        tags: validatedData.tags,
        is_public: validatedData.is_public,
        version: validatedData.version,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating prompt:', insertError);
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create prompt',
        insertError.message
      ), { status: 500 });
    }

    if (!data) {
      return NextResponse.json(createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'No data returned from prompt creation'
      ), { status: 500 });
    }

    // Return success response
    return NextResponse.json(createSuccessResponse({
      promptId: data.id,
      redirect: `/prompt/${data.id}`
    }, 'Prompt created successfully'));

  } catch (error) {
    console.error('Unexpected error in prompt creation:', error);
    return NextResponse.json(createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    ), { status: 500 });
  }
}

