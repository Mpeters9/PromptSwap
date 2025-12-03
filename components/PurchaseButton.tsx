'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  promptId: string;
  label?: string;
};

const errorMessages: Record<string, string> = {
  insufficient_credits: 'Not enough credits to buy this prompt.',
  already_owned: 'You already own this prompt.',
  cannot_buy_own_prompt: 'You cannot buy your own prompt.',
  unauthorized: 'Please sign in to purchase this prompt.',
};

export function PurchaseButton({ promptId, label = 'Purchase' }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId }),
      });

      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };

      if (res.ok && data?.success) {
        router.replace(`/prompts/${promptId}`);
        return;
      }

      const code = data?.error ?? 'purchase_failed';
      console.error('Purchase failed response', { status: res.status, code, body: data });
      setError(errorMessages[code] ?? 'Purchase failed. Please try again.');
    } catch (err: any) {
      console.error('Purchase request error', err);
      setError(err?.message ?? 'Purchase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handlePurchase}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Processing...' : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
