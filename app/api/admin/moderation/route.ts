import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and service role key are required for admin routes.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function getToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '').trim();
}

async function getUser(req: NextRequest) {
  const token = getToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', userId).single();
  if (error) throw error;
  if (!data?.is_admin) throw new Error('Forbidden');
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await assertAdmin(user.id);
  } catch (err: any) {
    const status = err.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: err.message ?? 'Forbidden' }, { status });
  }

  try {
    const [pendingRes, txRes, flaggedRes] = await Promise.all([
      supabaseAdmin
        .from('prompts')
        .select('id, title, user_id, created_at, price, is_public')
        .eq('is_public', false)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('prompt_sales')
        .select('id, prompt_id, amount, buyer_id, seller_id, stripe_txn_id, created_at, prompts(title)')
        .order('created_at', { ascending: false })
        .limit(25),
      supabaseAdmin
        .from('prompt_ratings')
        .select('prompt_id, rating, comment, created_at, user_id, prompts(title, user_id)')
        .lte('rating', 2)
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    if (pendingRes.error) throw pendingRes.error;
    if (txRes.error) throw txRes.error;
    if (flaggedRes.error) {
      // If flagged table unavailable, continue gracefully.
      console.warn('Flagged fetch error', flaggedRes.error);
    }

    return NextResponse.json({
      pendingPrompts: pendingRes.data ?? [],
      transactions: txRes.data ?? [],
      flagged: flaggedRes.data ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to load admin data' }, { status: 500 });
  }
}

type ActionBody =
  | { action: 'approve'; promptId: string }
  | { action: 'reject'; promptId: string }
  | { action: 'ban'; userId: string };

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await assertAdmin(user.id);
  } catch (err: any) {
    const status = err.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: err.message ?? 'Forbidden' }, { status });
  }

  let body: ActionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    if (body.action === 'approve') {
      await supabaseAdmin.from('prompts').update({ is_public: true }).eq('id', body.promptId);
    } else if (body.action === 'reject') {
      await supabaseAdmin.from('prompts').update({ is_public: false }).eq('id', body.promptId);
    } else if (body.action === 'ban') {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', body.userId);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to process action' }, { status: 500 });
  }
}
