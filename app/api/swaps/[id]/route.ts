import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

function getToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '').trim();
}

async function getUserId(req: NextRequest, supabaseAdmin: ReturnType<typeof createClient>) {
  const token = getToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server misconfigured: Supabase URL and service role key are required for swap routes.' },
      { status: 500 },
    );
  }

  const userId = await getUserId(req, supabaseAdmin);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;

  let body: { status?: 'accepted' | 'rejected' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = body.status;
  if (!status || !['accepted', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be accepted or rejected' }, { status: 400 });
  }

  // Fetch swap
  const { data: swap, error: swapError } = await supabaseAdmin
    .from('swaps')
    .select('id, requester_id, responder_id, requested_prompt_id, offered_prompt_id, status')
    .eq('id', id)
    .single();

  if (swapError || !swap) {
    return NextResponse.json({ error: 'Swap not found' }, { status: 404 });
  }

  if (swap.requester_id !== userId && swap.responder_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (swap.status !== 'pending') {
    return NextResponse.json({ error: 'Swap is already resolved' }, { status: 400 });
  }

  if (status === 'accepted' && swap.responder_id !== userId) {
    return NextResponse.json({ error: 'Only the responder can accept a swap' }, { status: 403 });
  }

  if (status === 'accepted') {
    const copyResult = await copyPromptsBetweenUsers(
      swap.requested_prompt_id,
      swap.offered_prompt_id,
      swap.requester_id,
      swap.responder_id,
      supabaseAdmin,
    );
    if (copyResult.error) {
      return NextResponse.json({ error: copyResult.error }, { status: 500 });
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('swaps')
    .update({ status })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ status });
}

async function copyPromptsBetweenUsers(
  requestedPromptId: string,
  offeredPromptId: string,
  requesterId: string,
  responderId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  try {
    const { data: prompts, error } = await supabaseAdmin
      .from('prompts')
      .select('id, title, description, tags, price, prompt_text, preview_image, is_public, version')
      .in('id', [requestedPromptId, offeredPromptId]);
    if (error) throw error;

    const requested = prompts?.find((p) => p.id === requestedPromptId);
    const offered = prompts?.find((p) => p.id === offeredPromptId);

    if (!requested || !offered) {
      return { error: 'One or more prompts not found' };
    }

    const inserts = [
      {
        user_id: requesterId,
        title: requested.title,
        description: requested.description,
        tags: requested.tags,
        price: requested.price,
        prompt_text: requested.prompt_text,
        preview_image: requested.preview_image,
        is_public: false,
        version: requested.version ?? 1,
      },
      {
        user_id: responderId,
        title: offered.title,
        description: offered.description,
        tags: offered.tags,
        price: offered.price,
        prompt_text: offered.prompt_text,
        preview_image: offered.preview_image,
        is_public: false,
        version: offered.version ?? 1,
      },
    ];

    const { error: insertError } = await supabaseAdmin.from('prompts').insert(inserts);
    if (insertError) throw insertError;

    return { error: null };
  } catch (err: any) {
    return { error: err.message ?? 'Failed to copy prompts' };
  }
}
