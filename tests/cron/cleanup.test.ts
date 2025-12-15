import { describe, expect, it } from 'vitest';
import { getCleanupConfig, getCleanupCutoffs } from '@/lib/cron/cleanup';

describe('cleanup retention helpers', () => {
  it('returns sane defaults', () => {
    const config = getCleanupConfig();
    expect(config.stripeEventsDays).toBe(60);
    expect(config.rateLimitsDays).toBe(21);
    expect(config.notificationsReadDays).toBe(180);
  });

  it('calculates cutoff dates for the given clock', () => {
    const config = {
      stripeEventsDays: 60,
      rateLimitsDays: 21,
      notificationsReadDays: 180,
    };
    const now = new Date('2025-12-15T00:00:00.000Z');
    const { stripeCutoff, rateLimitCutoff, notificationsCutoff } = getCleanupCutoffs(config, now);

    expect(stripeCutoff).toBe('2025-10-16T00:00:00.000Z');
    expect(rateLimitCutoff).toBe('2025-11-24T00:00:00.000Z');
    expect(notificationsCutoff).toBe('2025-06-18T00:00:00.000Z');
  });
});
