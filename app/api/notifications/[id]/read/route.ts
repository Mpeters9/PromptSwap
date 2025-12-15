import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createAuthErrorResponse, createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(createAuthErrorResponse(), { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.DATABASE_ERROR, 'Failed to update notification', { message: error.message }),
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(createErrorResponse(ErrorCodes.NOT_FOUND, 'Notification not found'), { status: 404 });
  }

  return NextResponse.json(createSuccessResponse({ id: data.id, is_read: true }));
}
