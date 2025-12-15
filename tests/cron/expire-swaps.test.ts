import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createSupabaseMock } from '../test-utils/mockSupabase';

let POST: any;
let supabaseMockRef: any;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: vi.fn(() => Promise.resolve(supabaseMockRef)),
}));

beforeAll(async () => {
  process.env.CRON_SECRET = 'cron-secret';
  process.env.SWAP_EXPIRES_DAYS = '7';
  ({ POST } = await import('@/app/api/cron/expire-swaps/route'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cron expire swaps', () => {
  it('rejects requests without the cron secret', async () => {
    supabaseMockRef = createSupabaseMock();
    const req = new NextRequest('http://localhost/api/cron/expire-swaps', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('expires requested swaps older than the cutoff without affecting new ones', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-10T00:00:00.000Z'));

    supabaseMockRef = createSupabaseMock({
      swaps: [
        {
          id: 'swap-old',
          requester_id: 'req1',
          responder_id: 'res1',
          requested_prompt_id: 'p1',
          offered_prompt_id: 'p2',
          status: 'requested',
          created_at: '2025-12-01T00:00:00Z',
        },
        {
          id: 'swap-new',
          requester_id: 'req2',
          responder_id: 'res2',
          requested_prompt_id: 'p3',
          offered_prompt_id: 'p4',
          status: 'requested',
          created_at: '2025-12-08T00:00:00Z',
        },
      ],
    });

    const req = new NextRequest('http://localhost/api/cron/expire-swaps', {
      method: 'POST',
      headers: { CRON_SECRET: 'cron-secret' },
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.expired).toBe(1);
    expect(body.checked).toBe(1);
    expect(supabaseMockRef.data.swaps.find((s: any) => s.id === 'swap-old')?.status).toBe('expired');
    expect(supabaseMockRef.data.swaps.find((s: any) => s.id === 'swap-new')?.status).toBe('requested');
    const notifications = supabaseMockRef.data.notifications.filter((n: any) => n.type === 'swap.expired');
    expect(notifications).toHaveLength(2);
  });
});
