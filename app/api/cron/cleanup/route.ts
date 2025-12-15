import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { recordSystemEvent } from '@/lib/system-events';
import { getCleanupConfig, getCleanupCutoffs } from '@/lib/cron/cleanup';
import { logger } from '@/lib/logging';

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: 'Cron secret is not configured' }, { status: 500 });
  }

  const providedSecret = request.headers.get('CRON_SECRET');
  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestId = crypto.randomUUID();
  let supabaseAdmin: any | null = null;
  const config = getCleanupConfig();
  const cutoffs = getCleanupCutoffs(config);

  try {
    supabaseAdmin = await createSupabaseAdminClient();
    const { data: stripeDeleted, error: stripeError } = await supabaseAdmin
      .from('stripe_events')
      .delete()
      .lt('created_at', cutoffs.stripeCutoff)
      .select('id');

    if (stripeError) {
      throw stripeError;
    }

    const { data: rateLimitDeleted, error: rateLimitError } = await supabaseAdmin
      .from('rate_limits')
      .delete()
      .lt('expires_at', cutoffs.rateLimitCutoff)
      .select('key');

    if (rateLimitError) {
      throw rateLimitError;
    }

    const { data: notificationsDeleted, error: notificationsError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('is_read', true)
      .lt('created_at', cutoffs.notificationsCutoff)
      .select('id');

    if (notificationsError) {
      throw notificationsError;
    }

    const counts = {
      stripeEvents: stripeDeleted?.length ?? 0,
      rateLimits: rateLimitDeleted?.length ?? 0,
      notifications: notificationsDeleted?.length ?? 0,
    };

    logger.info('Cleanup job completed', {
      requestId,
      counts,
      retention: config,
    }, 'CRON_CLEANUP_COMPLETED');

    return NextResponse.json({ requestId, counts });
  } catch (error: any) {
    logger.error('Cleanup job failed', { requestId }, error as Error, 'CRON_CLEANUP_FAILED');
    try {
      const adminClient =
        supabaseAdmin ?? (await createSupabaseAdminClient().catch(() => null));
      if (adminClient) {
        await recordSystemEvent(adminClient, {
          type: 'cron/cleanup',
          requestId,
          payloadSummary: {
            retention: getCleanupConfig(),
          },
          errorMessage: error?.message ?? 'Cleanup job failed',
        });
      }
    } catch (eventError) {
      logger.error(
        'Failed to log cleanup failure to system events',
        { requestId },
        eventError as Error,
        'SYSTEM_EVENT_CLEANUP_LOG_FAILED'
      );
    }
    return NextResponse.json({ error: 'Cleanup job failed' }, { status: 500 });
  }
}
