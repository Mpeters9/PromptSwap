import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { transitionSwap } from '@/lib/swaps/state';
import { emitSwapNotifications } from '@/lib/swaps/notifications';
import { recordSystemEvent } from '@/lib/system-events';

const DEFAULT_SWAP_EXPIRES_DAYS = 7;
const configuredExpiry = Number(process.env.SWAP_EXPIRES_DAYS);
const SWAP_EXPIRES_DAYS =
  Number.isFinite(configuredExpiry) && configuredExpiry > 0 ? configuredExpiry : DEFAULT_SWAP_EXPIRES_DAYS;

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: 'Cron secret is not configured' }, { status: 500 });
  }

  const providedSecret = request.headers.get('CRON_SECRET');
  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let supabaseAdmin: any | null = null;
  let inspected = 0;
  const requestId = crypto.randomUUID();

  try {
    supabaseAdmin = await createSupabaseAdminClient();
    const expirationMillis = SWAP_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - expirationMillis).toISOString();

    const { data: swaps, error } = await supabaseAdmin
      .from('swaps')
      .select('id,requester_id,responder_id,status,created_at')
      .eq('status', 'requested')
      .lt('created_at', cutoff);

    if (error) {
      throw error;
    }

    inspected = swaps?.length ?? 0;
    let expiredCount = 0;
    for (const swap of swaps ?? []) {
      try {
        const swapRequestId = crypto.randomUUID();
        const result = await transitionSwap(supabaseAdmin, swap.id, null, 'expire', swapRequestId);
        await emitSwapNotifications(supabaseAdmin, 'expire', result.swap, swapRequestId);
        expiredCount += 1;
      } catch (error) {
        console.error('Failed to expire swap', { swapId: swap.id }, error);
      }
    }

    return NextResponse.json({ expired: expiredCount, checked: inspected });
  } catch (error: any) {
    console.error('Failed to run swap expiry job', { requestId, inspected }, error);
    try {
      const adminClient =
        supabaseAdmin ?? (await createSupabaseAdminClient().catch(() => null));
      if (adminClient) {
        await recordSystemEvent(adminClient, {
          type: 'cron/expire-swaps',
          requestId,
          payloadSummary: { inspected },
          errorMessage: error?.message ?? 'Swap expiry failed',
        });
      }
    } catch (eventError) {
      console.error('Failed to log system event for swap expiry', eventError);
    }
    return NextResponse.json({ error: 'Failed to run swap expiry job' }, { status: 500 });
  }
}
