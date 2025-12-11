import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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

const sanitize = (value: string) =>
  value.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 2000); // trim to practical length

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server misconfigured: Supabase URL and service role key are required for comments API.' },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('prompt_comments')
      .select('id, user_id, comment, created_at')
      .eq('prompt_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server misconfigured: Supabase URL and service role key are required for comments API.' },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  const userId = await getUserId(req, supabaseAdmin);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const comment = sanitize((body.comment ?? '').trim());
  if (!comment) {
    return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('prompt_comments')
      .insert({
        prompt_id: id,
        user_id: userId,
        comment,
      })
      .select('id, user_id, comment, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ comment: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to add comment' }, { status: 500 });
  }
}
