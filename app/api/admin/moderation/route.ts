import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminModerationSchema } from '@/lib/validation/schemas';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/responses';
import { assertAdminAccess, getAdminUser, requireAdminSupabaseClient } from '@/lib/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authenticateAdmin(req: NextRequest) {
  let supabaseAdmin;
  try {
    supabaseAdmin = requireAdminSupabaseClient();
  } catch (err: any) {
    return { error: 'SERVER_ERROR' as const };
  }

  const user = await getAdminUser(req, supabaseAdmin);
  if (!user) {
    return { error: 'UNAUTHORIZED' as const, supabaseAdmin };
  }

  try {
    await assertAdminAccess(user.id, supabaseAdmin);
  } catch (err: any) {
    return {
      error: err.message === 'Forbidden' ? 'FORBIDDEN' as const : 'SERVER_ERROR' as const,
      supabaseAdmin,
    };
  }

  return { supabaseAdmin, user };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  if (auth.error) {
    if (auth.error === 'UNAUTHORIZED') {
      return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    if (auth.error === 'FORBIDDEN') {
      return NextResponse.json(createErrorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }
    return NextResponse.json(
      createErrorResponse('SERVER_ERROR', 'Server misconfigured: Supabase URL and service role key are required for admin routes.'),
      { status: 500 }
    );
  }

  const { supabaseAdmin } = auth;
  try {
    const [pendingRes, txRes, flaggedRes] = await Promise.all([
      supabaseAdmin
        .from('prompts')
        .select('id, title, user_id, created_at, price, status, moderation_note')
        .eq('status', 'submitted')
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
  const auth = await authenticateAdmin(req);
  if (auth.error) {
    if (auth.error === 'UNAUTHORIZED') {
      return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    if (auth.error === 'FORBIDDEN') {
      return NextResponse.json(createErrorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }
    return NextResponse.json(
      createErrorResponse('SERVER_ERROR', 'Server misconfigured: Supabase URL and service role key are required for admin routes.'),
      { status: 500 }
    );
  }

  const { supabaseAdmin, user } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(createErrorResponse('INVALID_JSON', 'Invalid JSON in request body'), { status: 400 });
  }

  const validation = adminModerationSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      createErrorResponse('VALIDATION_ERROR', 'Invalid input data', validation.error.format()),
      { status: 400 }
    );
  }

  const { action, promptId, userId, reason } = validation.data;
  const normalizedReason = reason?.trim() || null;

  try {
    if (action === 'approve' && promptId) {
      const { error } = await supabaseAdmin
        .from('prompts')
        .update({
          is_public: true,
          status: 'approved',
          moderation_note: normalizedReason,
        })
        .eq('id', promptId);

      if (error) throw error;

      await supabaseAdmin.from('moderation_actions').insert({
        prompt_id: promptId,
        admin_id: user.id,
        action,
        reason: normalizedReason,
      });

      return NextResponse.json(createSuccessResponse({ message: 'Prompt approved successfully', promptId }));
    } else if (action === 'reject' && promptId) {
      const { error } = await supabaseAdmin
        .from('prompts')
        .update({
          is_public: false,
          status: 'rejected',
          moderation_note: normalizedReason,
        })
        .eq('id', promptId);

      if (error) throw error;

      await supabaseAdmin.from('moderation_actions').insert({
        prompt_id: promptId,
        admin_id: user.id,
        action,
        reason: normalizedReason,
      });

      return NextResponse.json(createSuccessResponse({ message: 'Prompt rejected successfully', promptId }));
    } else if (action === 'archive' && promptId) {
      const { error } = await supabaseAdmin
        .from('prompts')
        .update({
          is_public: false,
          status: 'archived',
          moderation_note: normalizedReason,
        })
        .eq('id', promptId);

      if (error) throw error;

      await supabaseAdmin.from('moderation_actions').insert({
        prompt_id: promptId,
        admin_id: user.id,
        action,
        reason: normalizedReason,
      });

      return NextResponse.json(createSuccessResponse({ message: 'Prompt archived successfully', promptId }));
    } else if (action === 'ban' && userId) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', userId);

      if (error) throw error;

      return NextResponse.json(createSuccessResponse({ message: 'User banned successfully', userId }));
    }

    return NextResponse.json(
      createErrorResponse('INVALID_ACTION', 'Unsupported action or missing required parameters'),
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('DATABASE_ERROR', err.message ?? 'Failed to process action'),
      { status: 500 }
    );
  }
}
