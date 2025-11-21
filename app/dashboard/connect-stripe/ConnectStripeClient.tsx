'use client';

import { useState } from 'react';

export default function ConnectStripeClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/connect-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to create Stripe link.');
      }
      const data = await res.json();
      if (!data?.url) throw new Error('Missing Stripe onboarding URL.');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message ?? 'Unable to start Stripe onboarding.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
      >
        {loading ? 'Redirecting…' : 'Connect your Stripe'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
