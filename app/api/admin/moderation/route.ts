import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GenericSupabaseClient } from '@/lib/supabase-types';
import { adminModerationSchema } from '@/lib/validation/schemas';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminProfileRow = { is_admin: boolean };

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

async function getUser(req: NextRequest, supabaseAdmin: GenericSupabaseClient) {
  const token = getToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function assertAdmin(userId: string, supabaseAdmin: GenericSupabaseClient) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single<AdminProfileRow>();
  if (error) throw error;

  if (!profile?.is_admin) {
    throw new Error('Forbidden');
  }
}

export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      createErrorResponse('SERVER_ERROR', 'Server misconfigured: Supabase URL and service role key are required for admin routes.'),
      { status: 500 },
    );
  }

  const user = await getUser(req, supabaseAdmin);
  if (!user) {
    return NextResponse.json(
      createErrorResponse('UNAUTHORIZED', 'Authentication required'),
      { status: 401 }
    );
  }

  try {
    await assertAdmin(user.id, supabaseAdmin);
  } catch (err: any) {
    const status = err.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json(
      createErrorResponse('FORBIDDEN', err.message ?? 'Admin access required'),
      { status }
    );
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

    return NextResponse.json(
      createSuccessResponse({
        pendingPrompts: pendingRes.data ?? [],
        transactions: txRes.data ?? [],
        flagged: flaggedRes.data ?? [],
      })
    );
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('DATABASE_ERROR', err.message ?? 'Failed to load admin data'),
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      createErrorResponse('SERVER_ERROR', 'Server misconfigured: Supabase URL and service role key are required for admin routes.'),
      { status: 500 },
    );
  }

  const user = await getUser(req, supabaseAdmin);
  if (!user) {
    return NextResponse.json(
      createErrorResponse('UNAUTHORIZED', 'Authentication required'),
      { status: 401 }
    );
  }

  try {
    await assertAdmin(user.id, supabaseAdmin);
  } catch (err: any) {
    const status = err.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json(
      createErrorResponse('FORBIDDEN', err.message ?? 'Admin access required'),
      { status }
    );
  }

  // Parse and validate request body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      createErrorResponse('INVALID_JSON', 'Invalid JSON in request body'),
      { status: 400 }
    );
  }

  // Validate input using Zod schema
  const validation = adminModerationSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      createErrorResponse('VALIDATION_ERROR', 'Invalid input data', validation.error.format()),
      { status: 400 }
    );
  }

  const { action, promptId, userId } = validation.data;

  try {
    if (action === 'approve' && promptId) {
      const { error } = await supabaseAdmin
        .from('prompts')
        .update({ is_public: true })
        .eq('id', promptId);
      if (error) throw error;
      
      return NextResponse.json(
        createSuccessResponse({ message: 'Prompt approved successfully', promptId })
      );
    } else if (action === 'reject' && promptId) {
      const { error } = await supabaseAdmin
        .from('prompts')
        .update({ is_public: false })
        .eq('id', promptId);
      if (error) throw error;
      
      return NextResponse.json(
        createSuccessResponse({ message: 'Prompt rejected successfully', promptId })
      );
    } else if (action === 'ban' && userId) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', userId);
      if (error) throw error;
      
      return NextResponse.json(
        createSuccessResponse({ message: 'User banned successfully', userId })
      );
    } else {
      return NextResponse.json(
        createErrorResponse('INVALID_ACTION', 'Unsupported action or missing required parameters'),
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('DATABASE_ERROR', err.message ?? 'Failed to process action'),
      { status: 500 }
    );
  }
}
