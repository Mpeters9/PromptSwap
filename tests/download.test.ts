import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createSupabaseMock } from './test-utils/mockSupabase';

let GET: any;
let supabaseMockRef: any;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(supabaseMockRef)),
}));

beforeAll(async () => {
  ({ GET } = await import('@/app/api/prompts/[id]/download/route'));
});

describe('download route entitlement', () => {
  it('allows download for paid purchase', async () => {
    supabaseMockRef = createSupabaseMock({
      authUser: { id: 'buyer1' },
      prompts: [{ id: 1, user_id: 'seller1', title: 'Test', prompt_text: 'content' }],
      purchases: [{ id: 'p1', buyer_id: 'buyer1', prompt_id: 1, status: 'paid' }],
    });

    const req = new NextRequest('http://localhost/api/prompts/1/download');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) } as any);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('content');
  });

  it('blocks download for refunded purchase', async () => {
    supabaseMockRef = createSupabaseMock({
      authUser: { id: 'buyer2' },
      prompts: [{ id: 1, user_id: 'seller1', title: 'Test', prompt_text: 'content' }],
      purchases: [{ id: 'p2', buyer_id: 'buyer2', prompt_id: 1, status: 'refunded' }],
    });

    const req = new NextRequest('http://localhost/api/prompts/1/download');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) } as any);
    expect(res.status).toBe(403);
  });
});
