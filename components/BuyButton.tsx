'use client';

import { useState } from 'react';

type Props = {
  promptId: string;
  price: number;
};

export default function BuyButton({ promptId, price }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start checkout');
      }
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message ?? 'Unable to start checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {loading ? 'Processing...' : `Buy for $${price.toFixed(2)}`}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
