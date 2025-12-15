import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { commentSchema } from '@/lib/validation/schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse, 
  createAuthErrorResponse, 
  createNotFoundErrorResponse,
  ErrorCodes 
} from '@/lib/api/responses';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const promptId = params.id;

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Check if prompt exists
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id')
      .eq('id', promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json(createNotFoundErrorResponse('Prompt'), { status: 404 });
    }

    // Get comments for the prompt
    const { data: comments, error: commentsError } = await supabase
      .from('prompt_comments')
      .select('id, user_id, comment, created_at')
      .eq('prompt_id', promptId)
      .order('created_at', { ascending: false });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch comments'
      ), { status: 500 });
    }

    // Return success response
    return NextResponse.json(createSuccessResponse({
      comments: comments || []
    }));

  } catch (error) {
    console.error('Unexpected error in comments fetch:', error);
    return NextResponse.json(createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    ), { status: 500 });
  }
}

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

    const promptId = params.id;

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
    const validationResult = commentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 }
      );
    }

    const { comment: commentText } = validationResult.data;

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Check if prompt exists
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id')
      .eq('id', promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json(createNotFoundErrorResponse('Prompt'), { status: 404 });
    }

    // Insert the comment
    const { data: comment, error: insertError } = await supabase
      .from('prompt_comments')
      .insert({
        prompt_id: promptId,
        user_id: user.id,
        comment: commentText,
      })
      .select('id, user_id, comment, created_at')
      .single();

    if (insertError) {
      console.error('Error inserting comment:', insertError);
      return NextResponse.json(createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Failed to add comment'
      ), { status: 500 });
    }

    // Return success response
    return NextResponse.json(createSuccessResponse({
      comment
    }, 'Comment added successfully'));

  } catch (error) {
    console.error('Unexpected error in comment submission:', error);
    return NextResponse.json(createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    ), { status: 500 });
  }
}

