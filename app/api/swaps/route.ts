import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GenericSupabaseClient } from '@/lib/supabase-types';

export const runtime = 'nodejs';

function getSupabaseAdmin(): GenericSupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey) as GenericSupabaseClient;
}

function getToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '').trim();
}

async function getUserId(req: NextRequest, supabaseAdmin: GenericSupabaseClient) {
  const token = getToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server misconfigured: Supabase URL and service role key are required for swap routes.' },
      { status: 500 },
    );
  }

  const userId = await getUserId(req, supabaseAdmin);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { requestedPromptId?: string; offeredPromptId?: string; responderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { requestedPromptId, offeredPromptId, responderId } = body;
  if (!requestedPromptId || !offeredPromptId || !responderId) {
    return NextResponse.json({ error: 'requestedPromptId, offeredPromptId, and responderId are required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('swaps')
      .insert({
        id: crypto.randomUUID(),
        requester_id: userId,
        responder_id: responderId,
        requested_prompt_id: requestedPromptId,
        offered_prompt_id: offeredPromptId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to create swap' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server misconfigured: Supabase URL and service role key are required for swap routes.' },
      { status: 500 },
    );
  }

  const userId = await getUserId(req, supabaseAdmin);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [incomingRes, outgoingRes] = await Promise.all([
      supabaseAdmin
        .from('swaps')
        .select('id, requester_id, responder_id, requested_prompt_id, offered_prompt_id, status, created_at')
        .eq('responder_id', userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('swaps')
        .select('id, requester_id, responder_id, requested_prompt_id, offered_prompt_id, status, created_at')
        .eq('requester_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    if (incomingRes.error) throw incomingRes.error;
    if (outgoingRes.error) throw outgoingRes.error;

    const promptIds = [
      ...(incomingRes.data ?? []).flatMap((s) => [s.requested_prompt_id, s.offered_prompt_id]),
      ...(outgoingRes.data ?? []).flatMap((s) => [s.requested_prompt_id, s.offered_prompt_id]),
    ].filter(Boolean) as string[];

    const uniquePromptIds = Array.from(new Set(promptIds));
    const promptMap: Record<string, any> = {};

    if (uniquePromptIds.length) {
      const { data: prompts } = await supabaseAdmin
        .from('prompts')
        .select('id, title, preview_image, price, user_id')
        .in('id', uniquePromptIds);
      prompts?.forEach((p) => {
        promptMap[p.id] = p;
      });
    }

    const withPrompts = (rows: any[]) =>
      rows.map((s) => ({
        ...s,
        requested_prompt: promptMap[s.requested_prompt_id] ?? null,
        offered_prompt: promptMap[s.offered_prompt_id] ?? null,
      }));

    return NextResponse.json({
      incoming: withPrompts(incomingRes.data ?? []),
      outgoing: withPrompts(outgoingRes.data ?? []),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to fetch swaps' }, { status: 500 });
  }
}
