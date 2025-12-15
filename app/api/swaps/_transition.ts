import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, getCurrentUser } from '@/lib/supabase/server';
import { transitionSwap, SwapAction } from '@/lib/swaps/state';
import { createAuthErrorResponse, createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api/responses';
import { emitSwapNotifications } from '@/lib/swaps/notifications';

export async function handleSwapAction(request: Request, swapId: string, action: SwapAction) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(createAuthErrorResponse(), { status: 401 });
  }

  const supabaseAdmin = await createSupabaseAdminClient();
  const requestId = crypto.randomUUID();

  try {
    const result = await transitionSwap(supabaseAdmin, swapId, user.id, action, requestId, {
      fulfillHandler: action === 'fulfill' ? (swap) => copyPromptsBetweenUsers(supabaseAdmin, swap) : undefined,
    });

    await emitSwapNotifications(supabaseAdmin, action, result.swap, requestId);

    return NextResponse.json(createSuccessResponse({ swapId, status: result.status }), { status: 200 });
  } catch (err: any) {
    const statusCode = err?.statusCode || 500;
    const message = err?.message || 'Swap action failed';
    return NextResponse.json(createErrorResponse(err?.code || ErrorCodes.INTERNAL_ERROR, message, err?.details), {
      status: statusCode,
    });
  }
}

async function copyPromptsBetweenUsers(supabase: any, swap: { requested_prompt_id: string; offered_prompt_id: string; requester_id: string; responder_id: string }) {
  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('id, title, description, tags, price, prompt_text, preview_image, version')
    .in('id', [swap.requested_prompt_id, swap.offered_prompt_id]);

  if (error) {
    throw error;
  }

  const requested = prompts?.find((p: any) => p.id === swap.requested_prompt_id);
  const offered = prompts?.find((p: any) => p.id === swap.offered_prompt_id);

  if (!requested || !offered) {
    throw new Error('One or more prompts not found for fulfillment');
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from('prompts').insert([
    {
      user_id: swap.requester_id,
      title: offered.title,
      description: offered.description,
      tags: offered.tags,
      price: offered.price,
      prompt_text: offered.prompt_text,
      preview_image: offered.preview_image,
      is_public: false,
      version: offered.version ?? 1,
      created_at: now,
    },
    {
      user_id: swap.responder_id,
      title: requested.title,
      description: requested.description,
      tags: requested.tags,
      price: requested.price,
      prompt_text: requested.prompt_text,
      preview_image: requested.preview_image,
      is_public: false,
      version: requested.version ?? 1,
      created_at: now,
    },
  ]);

  if (insertError) {
    throw insertError;
  }
}
