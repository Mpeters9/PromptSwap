
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/responses';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Create server client for authentication

    const supabase = await createSupabaseServerClient();
    
    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse('UNAUTHORIZED', 'Authentication required'),
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const promptId = Number(id);
    

    // Validate prompt ID
    if (!Number.isInteger(promptId) || promptId <= 0) {
      return NextResponse.json(
        createErrorResponse('INVALID_INPUT', 'Invalid prompt ID'),
        { status: 400 }
      );
    }

    // Update like count
    const { data, error } = await supabase
      .rpc('increment_prompt_likes', { prompt_id: promptId });

    if (error) {
      console.error('Like update failed', error);
      return NextResponse.json(
        createErrorResponse('DATABASE_ERROR', 'Failed to update like count'),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({ likes: data, promptId })
    );
  } catch (err: any) {
    console.error('Like route error', err);
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}
