'use client';

import { useState } from 'react';

export const dynamic = 'force-dynamic';

function ConnectStripeButton() {
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const redirectUri = `${siteUrl}/dashboard/connect-stripe`;

  const handleClick = () => {
    if (!clientId) {
      setError('Stripe client ID is missing. Set NEXT_PUBLIC_STRIPE_CLIENT_ID.');
      return;
    }
    const url = new URL('https://connect.stripe.com/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'read_write');
    url.searchParams.set('redirect_uri', redirectUri);
    window.location.href = url.toString();
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        Connect your Stripe
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function ConnectStripePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const redirectUri = `${siteUrl}/dashboard/connect-stripe`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Connect Stripe</h1>
        <p className="mt-2 text-sm text-slate-600">
          Connect your Stripe account to receive payouts. You&apos;ll be redirected to Stripe to complete onboarding.
        </p>
        <div className="mt-8">
          <ConnectStripeButton />
        </div>
        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Redirect URLs</p>
          <p>
            Ensure the return/refresh URL is allowed in Stripe Dashboard (Developers → Connect → Settings), e.g.
            <code> {redirectUri} </code>.
          </p>
        </div>
      </div>
    </div>
  );
}
