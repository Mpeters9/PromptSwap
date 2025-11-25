'use client';

import { useState } from 'react';

type Props = {
  promptId: string;
  title: string;
  price: number; // dollars
  userId?: string;
};

type CheckoutResponse = {
  url?: string;
  error?: string;
};

export default function BuyButton({ promptId, title, price, userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    const priceInCents = Math.round(Number(price) * 100);
    if (!promptId || !title || !Number.isFinite(priceInCents) || priceInCents <= 0) {
      const message = 'Missing or invalid checkout details.';
      console.error(message, { promptId, title, priceInCents });
      setError(message);
      alert(message);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        prompt_id: promptId,
        title,
        price: priceInCents,
        user_id: userId,
      };

      console.log('Creating checkout session with payload', payload);

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CheckoutResponse;
      console.log('Checkout session response', { status: res.status, data });
      if (!res.ok || !data?.url) {
        const message = data?.error ?? 'Failed to start checkout';
        console.error('Checkout session failed', { status: res.status, data });
        setError(message);
        alert(message);
        return;
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Checkout request error', err);
      const message = err?.message ?? 'Unable to start checkout';
      setError(message);
      alert(message);
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
