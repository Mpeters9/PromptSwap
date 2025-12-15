import { describe, it, expect } from 'vitest';
import { transitionSwap } from '@/lib/swaps/state';
import { createSupabaseMock } from './test-utils/mockSupabase';

const baseSwap = {
  id: 'swap1',
  requester_id: 'req1',
  responder_id: 'res1',
  requested_prompt_id: 'p1',
  offered_prompt_id: 'p2',
  status: 'requested',
};

function supabaseWithSwap(status: string) {
  return createSupabaseMock({ swaps: [{ ...baseSwap, status }] });
}

describe('swap state machine', () => {
  it('accept happy path', async () => {
    const supabase = supabaseWithSwap('requested');
    const res = await transitionSwap(supabase, 'swap1', 'res1', 'accept', 'req-1');
    expect(res.status).toBe('accepted');
    expect(supabase.data.swaps[0].status).toBe('accepted');
  });

  it('decline happy path', async () => {
    const supabase = supabaseWithSwap('requested');
    const res = await transitionSwap(supabase, 'swap1', 'res1', 'decline', 'req-2');
    expect(res.status).toBe('declined');
  });

  it('cancel happy path', async () => {
    const supabase = supabaseWithSwap('requested');
    const res = await transitionSwap(supabase, 'swap1', 'req1', 'cancel', 'req-3');
    expect(res.status).toBe('cancelled');
  });

  it('illegal accept after declined', async () => {
    const supabase = supabaseWithSwap('declined');
    await expect(transitionSwap(supabase, 'swap1', 'res1', 'accept', 'req-4')).rejects.toThrow(/Cannot accept/);
  });

  it('non-participant cannot accept', async () => {
    const supabase = supabaseWithSwap('requested');
    await expect(transitionSwap(supabase, 'swap1', 'other', 'accept', 'req-5')).rejects.toThrow(/Only responder/);
  });

  it('fulfill before accepted fails', async () => {
    const supabase = supabaseWithSwap('requested');
    await expect(transitionSwap(supabase, 'swap1', 'req1', 'fulfill', 'req-6')).rejects.toThrow(/Cannot fulfill/);
  });
});
