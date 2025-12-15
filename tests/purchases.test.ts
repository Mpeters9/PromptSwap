import { describe, it, expect } from 'vitest';
import { canDownloadPurchase } from '@/lib/purchases';

describe('canDownloadPurchase', () => {
  it('allows paid', () => {
    expect(canDownloadPurchase({ status: 'paid' })).toBe(true);
  });

  it('allows partially_refunded', () => {
    expect(canDownloadPurchase({ status: 'partially_refunded' })).toBe(true);
  });

  it('allows disputed', () => {
    expect(canDownloadPurchase({ status: 'disputed' })).toBe(true);
  });

  it('blocks refunded', () => {
    expect(canDownloadPurchase({ status: 'refunded' })).toBe(false);
  });

  it('blocks pending and failed', () => {
    expect(canDownloadPurchase({ status: 'pending' })).toBe(false);
    expect(canDownloadPurchase({ status: 'failed' })).toBe(false);
  });

  it('blocks missing purchase', () => {
    expect(canDownloadPurchase(undefined)).toBe(false);
  });
});
