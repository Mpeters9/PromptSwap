import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createAuthErrorResponse, createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(createAuthErrorResponse(), { status: 401 });
  }

  const limit = Math.max(1, Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? 10)));
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,title,body,url,is_read,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.DATABASE_ERROR, 'Failed to load notifications', { message: error.message }),
      { status: 500 }
    );
  }

  const { count, error: unreadError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (unreadError) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.DATABASE_ERROR, 'Failed to load unread count', { message: unreadError.message }),
      { status: 500 }
    );
  }

  return NextResponse.json(
    createSuccessResponse({
      notifications: data ?? [],
      unreadCount: count ?? 0,
    })
  );
}
