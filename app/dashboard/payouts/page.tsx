'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase-client';

type PurchaseRow = { amount: number | null };
type ProfileRow = { stripe_account_id: string | null };

export default function DashboardPayoutsPage() {
  const router = useRouter();
  const [earnings, setEarnings] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        router.replace('/auth/login');
        return;
      }
      const userId = sessionData.session.user.id;

      // Fetch profile for Stripe Connect status
      const { data: profileData, error: profileErr } = await supabase
        .from<ProfileRow>('profiles')
        .select('stripe_account_id')
        .eq('id', userId)
        .single();

      if (profileErr) {
        setError(profileErr.message);
        setLoading(false);
        return;
      }

      setAccountId(profileData?.stripe_account_id ?? null);

      // Earnings summary from purchases (if amount is stored)
      const { data, error: fetchErr } = await supabase.from<PurchaseRow>('purchases').select('amount');

      if (fetchErr) {
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      const total = data?.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) ?? 0;
      setEarnings(total);
      setLoading(false);
    };

    void load();
  }, [router]);

  const handleConnect = async () => {
    setConnectLoading(true);
    setConnectError(null);
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Unable to start Stripe Connect.');
      }
      window.location.href = data.url;
    } catch (err: any) {
      setConnectError(err.message ?? 'Failed to start Stripe Connect.');
    } finally {
      setConnectLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Payouts</h1>
        <p className="mt-2 text-sm text-slate-600">Payouts feature coming soon.</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {connectError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {connectError}
          </div>
        )}

        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Loading summary...</div>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="text-xs uppercase text-slate-500">Total Earnings (All time)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {earnings !== null ? `$${earnings.toFixed(2)}` : '$0.00'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Creator payouts will be available soon.</p>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Stripe Connect</p>
              <p className="mt-1 font-semibold text-slate-900">
                {accountId ? 'Connected' : 'Not connected'}
              </p>
              {accountId && (
                <p className="text-xs text-slate-500">Account ID: {accountId}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connectLoading}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {accountId ? 'Reconnect Stripe' : connectLoading ? 'Connecting...' : 'Connect Stripe Account'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Connect your Stripe account to receive payouts. This section will show payout history in the future.
          </p>
        </div>
      </div>
    </div>
  );
}
