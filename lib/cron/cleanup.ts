export interface CleanupRetentionConfig {
  stripeEventsDays: number;
  rateLimitsDays: number;
  notificationsReadDays: number;
}

function parseDays(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getCleanupConfig(): CleanupRetentionConfig {
  return {
    stripeEventsDays: parseDays(process.env.CRON_CLEANUP_RETENTION_STRIPE_DAYS, 60),
    rateLimitsDays: parseDays(process.env.CRON_CLEANUP_RETENTION_RATE_LIMIT_DAYS, 21),
    notificationsReadDays: parseDays(process.env.CRON_CLEANUP_RETENTION_NOTIFICATIONS_READ_DAYS, 180),
  };
}

export function getCleanupCutoffs(
  config: CleanupRetentionConfig,
  now: Date = new Date()
) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const stripeCutoff = new Date(now.getTime() - config.stripeEventsDays * oneDayMs).toISOString();
  const rateLimitCutoff = new Date(now.getTime() - config.rateLimitsDays * oneDayMs).toISOString();
  const notificationsCutoff = new Date(now.getTime() - config.notificationsReadDays * oneDayMs).toISOString();

  return { stripeCutoff, rateLimitCutoff, notificationsCutoff };
}
