'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase-client';

type ProfileRow = {
  stripe_account_id?: string | null;
  connected_account_id?: string | null;
};

type SaleRow = {
  id: string;
  price: number | null;
  created_at: string;
  buyer_id?: string | null;
  prompts: {
    title: string | null;
    price: number | null;
  } | null;
};

type PayoutRow = {
  id: string;
  amount: number | null;
  currency: string | null;
  stripe_transfer_id?: string | null;
  created_at: string;
};

export default function DashboardPayoutsPage() {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const earnings = useMemo(() => {
    const totalSales = sales.reduce((sum, sale) => sum + (Number(sale.price) || 0), 0);
    const totalPayouts = payouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const available = Math.max(0, totalSales - totalPayouts);
    return {
      total: totalSales,
      pending: 0,
      available,
      paid: totalPayouts,
    };
  }, [sales, payouts]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (sessionError || !userId) {
        router.replace('/auth/login');
        return;
      }

      const { data: profileData, error: profileErr } = await supabase
        .from<ProfileRow>('profiles')
        .select('stripe_account_id, connected_account_id')
        .eq('id', userId)
        .single();

      if (profileErr) {
        console.error('Payouts profile error', profileErr);
        setError(profileErr.message);
        setLoading(false);
        return;
      }

      setAccountId(profileData?.connected_account_id ?? profileData?.stripe_account_id ?? null);

      const [{ data: salesData, error: salesErr }, { data: payoutData, error: payoutsErr }] = await Promise.all([
        .from<SaleRow>('purchases')
        .select('id, price, buyer_id, created_at, prompts(title, price)')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from<PayoutRow>('payouts')
        .select('id, amount, currency, stripe_transfer_id, created_at')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false }),
      ]);

      if (salesErr || payoutsErr) {
        console.error('Payouts fetch error', { salesErr, payoutsErr });
        setError(salesErr?.message || payoutsErr?.message || 'Failed to load payouts.');
        setLoading(false);
        return;
      }

      setSales(salesData ?? []);
      setPayouts(payoutData ?? []);
      setLoading(false);
    };

    void load();
  }, [router]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Unable to start Stripe Connect.');
      }
      window.location.href = data.url;
    } catch (err: any) {
      setConnectError(err?.message || 'Failed to start Stripe Connect.');
    } finally {
      setConnecting(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) =>
    `$${Number(value || 0).toFixed(2)}`;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Payouts</h1>
        <p className="text-sm text-slate-600">
          Track your Stripe connection, earnings, and recent prompt sales.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}
      {connectError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {connectError}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase text-slate-500">Stripe Connect</p>
              <h2 className="text-xl font-semibold text-slate-900">
                {accountId ? 'Connected' : 'Not Connected'}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {accountId ? `Account: ${accountId}` : 'Connect to receive payouts.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? 'Connecting...' : 'Connect Stripe Account'}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Earnings</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-600">Total Earned</p>
              <p className="text-2xl font-semibold text-slate-900">{formatCurrency(earnings.total)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Paid Out</p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatCurrency(earnings.paid)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Available Balance</p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatCurrency(earnings.available)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Recent Sales</h3>
          <p className="text-xs text-slate-500">Sorted by newest</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0">
                <div className="space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : sales.length === 0 ? (
          <p className="text-sm text-slate-600">No sales yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="grid grid-cols-1 gap-2 py-3 text-sm text-slate-800 sm:grid-cols-4 sm:items-center"
              >
                <div className="font-semibold text-slate-900">
                  {sale.prompts?.title || 'Prompt'}
                </div>
                <div>{formatCurrency(sale.prompts?.price ?? sale.price ?? 0)}</div>
                <div className="text-slate-600">{sale.buyer_id || 'Buyer hidden'}</div>
                <div className="text-slate-500">{formatDate(sale.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Payout History</h3>
          <p className="text-xs text-slate-500">Latest payouts to your Stripe account</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <p className="text-sm text-slate-600">No payouts recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="grid grid-cols-1 gap-2 py-3 text-sm text-slate-800 sm:grid-cols-4 sm:items-center"
              >
                <div className="font-semibold text-slate-900">{formatCurrency(payout.amount ?? 0)}</div>
                <div className="text-slate-600 uppercase">{(payout.currency || 'usd').toUpperCase()}</div>
                <div className="text-slate-500 truncate" title={payout.stripe_transfer_id || undefined}>
                  {payout.stripe_transfer_id || 'Pending'}
                </div>
                <div className="text-slate-500">{formatDate(payout.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
