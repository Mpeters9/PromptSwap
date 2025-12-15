import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createAuthErrorResponse, createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(createAuthErrorResponse(), { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
    .select('id');

  if (error) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.DATABASE_ERROR, 'Failed to mark notifications as read', { message: error.message }),
      { status: 500 }
    );
  }

  return NextResponse.json(createSuccessResponse({ updated: data?.length ?? 0 }));
}
