import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and service role key are required for rating API.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function getToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '').trim();
}

async function getUserId(req: NextRequest) {
  const token = getToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { rating?: number; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be an integer 1-5' }, { status: 400 });
  }

  const comment =
    typeof body.comment === 'string'
      ? body.comment.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 2000)
      : null;

  try {
    const { error: upsertError } = await supabaseAdmin.from('prompt_ratings').upsert(
      {
        prompt_id: params.id,
        user_id: userId,
        rating,
        comment,
      },
      { onConflict: 'prompt_id,user_id' },
    );

    if (upsertError) throw upsertError;

    // recompute average rating
    const { data: agg, error: aggError } = await supabaseAdmin
      .from('prompt_ratings')
      .select('avg(rating)')
      .eq('prompt_id', params.id)
      .single();
    if (aggError) throw aggError;
    const average = Number((agg as any)?.avg) || Number((agg as any)?.['avg']) || 0;

    // best-effort cache update; ignore if column missing
    await supabaseAdmin.from('prompts').update({ average_rating: average }).eq('id', params.id);

    return NextResponse.json({ rating, average });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to submit rating' }, { status: 500 });
  }
}
