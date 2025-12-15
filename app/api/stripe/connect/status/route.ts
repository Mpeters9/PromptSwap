import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createAuthErrorResponse, createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api/responses';
import { getRequestId, withRequestIdHeader } from '@/lib/api/request-id';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const user = await getCurrentUser();
  if (!user) {
    const res = NextResponse.json(createAuthErrorResponse(), { status: 401 });
    return withRequestIdHeader(res, requestId);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_account_id, connected_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_account_status')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    const res = NextResponse.json(
      createErrorResponse(ErrorCodes.DATABASE_ERROR, 'Failed to load Stripe status'),
      { status: 500 }
    );
    return withRequestIdHeader(res, requestId);
  }

  const chargesEnabled = Boolean(data.stripe_charges_enabled);
  const payoutsEnabled = Boolean(data.stripe_payouts_enabled);
  const accountId = data.connected_account_id || data.stripe_account_id || null;
  const status = !accountId
    ? 'onboarding_required'
    : chargesEnabled && payoutsEnabled
      ? 'ready'
      : 'pending';

  const res = NextResponse.json(
    createSuccessResponse({
      accountId,
      chargesEnabled,
      payoutsEnabled,
      status,
      accountStatus: data.stripe_account_status ?? null,
    })
  );
  return withRequestIdHeader(res, requestId);
}
