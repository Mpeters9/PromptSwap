import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/api/responses';
import { assertAdminAccess, getAdminUser, requireAdminSupabaseClient } from '@/lib/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let supabaseAdmin: ReturnType<typeof requireAdminSupabaseClient>;
  try {
    supabaseAdmin = requireAdminSupabaseClient();
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('SERVER_ERROR', 'Server misconfigured: Supabase URL and service role key are required for admin routes.'),
      { status: 500 }
    );
  }

  const user = await getAdminUser(req, supabaseAdmin);
  if (!user) {
    return NextResponse.json(
      createErrorResponse('UNAUTHORIZED', 'Authentication required'),
      { status: 401 }
    );
  }

  try {
    await assertAdminAccess(user.id, supabaseAdmin);
  } catch (err: any) {
    const status = err.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json(
      createErrorResponse('FORBIDDEN', err.message ?? 'Admin access required'),
      { status }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('system_events')
      .select('id,type,error_message,request_id,payload_summary,created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        createErrorResponse('DATABASE_ERROR', 'Failed to load system events', { message: error.message }),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({ events: data ?? [] })
    );
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('DATABASE_ERROR', err.message ?? 'Failed to load system events'),
      { status: 500 }
    );
  }
}
