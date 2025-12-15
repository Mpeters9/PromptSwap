import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/responses';
import { canDownloadPurchase } from '@/lib/purchases';

export const runtime = 'nodejs';

const safeFilename = (title: string | null | undefined) => {
  const base = (title ?? 'prompt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'prompt'}.txt`;
};

export async function GET(
  _req: NextRequest,
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

    // Fetch prompt data
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, user_id, title, prompt_text')
      .eq('id', promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json(
        createErrorResponse('NOT_FOUND', 'Prompt not found'),
        { status: 404 }
      );
    }

    // Check authorization - user owns prompt or has eligible purchase
    if (prompt.user_id !== user.id) {
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id,status')
        .eq('buyer_id', user.id)
        .eq('prompt_id', prompt.id)
        .maybeSingle();

      if (!purchase || !canDownloadPurchase(purchase)) {
        return NextResponse.json(
          createErrorResponse('FORBIDDEN', 'You do not have permission to download this prompt'),
          { status: 403 }
        );
      }
    }

    const filename = safeFilename(prompt.title);
    const content = prompt.prompt_text ?? '';

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Download route error', err);
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}
