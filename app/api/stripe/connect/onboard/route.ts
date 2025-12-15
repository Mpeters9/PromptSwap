import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient, createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createAuthErrorResponse, createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api/responses';
import { getRequestId, withRequestIdHeader } from '@/lib/api/request-id';
import { logger } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: '2024-04-10' });
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getCurrentUser();
  if (!user) {
    const res = NextResponse.json(createAuthErrorResponse(), { status: 401 });
    return withRequestIdHeader(res, requestId);
  }

  const stripe = getStripe();
  if (!stripe) {
    const res = NextResponse.json(
      createErrorResponse(ErrorCodes.SERVER_ERROR, 'Stripe not configured'),
      { status: 500 }
    );
    return withRequestIdHeader(res, requestId);
  }

  const supabaseAdmin = await createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id, connected_account_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    logger.error('Connect onboard profile fetch failed', { requestId, userId: user.id }, profileError as any, 'CONNECT_PROFILE_ERROR');
    const res = NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR, 'Profile lookup failed'), { status: 500 });
    return withRequestIdHeader(res, requestId);
  }

  let accountId = profile?.connected_account_id || profile?.stripe_account_id || null;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'standard', metadata: { userId: user.id } });
    accountId = account.id;
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id);
    if (updateError) {
      logger.error('Failed to persist new Stripe account', { requestId, userId: user.id }, updateError as any, 'CONNECT_ACCOUNT_SAVE_FAILED');
      const res = NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR, 'Failed to save account'), { status: 500 });
      return withRequestIdHeader(res, requestId);
    }
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${siteUrl}/dashboard/connect-stripe`,
    return_url: `${siteUrl}/dashboard/connect-stripe`,
    type: 'account_onboarding',
  });

  const res = NextResponse.json(
    createSuccessResponse({
      url: accountLink.url,
      accountId,
    })
  );
  return withRequestIdHeader(res, requestId);
}
