'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import LogoutButton from '@/components/LogoutButton';
import { supabase } from '@/lib/supabase-client';

type PromptRow = { id: string };
type PurchaseRow = {
  id: string;
  prompt_id: string | null;
  amount: number | null;
  buyer_id: string | null;
  created_at: string;
  prompts: { title: string | null } | null;
};
type ProfileRow = { stripe_account_id: string | null };

type Stats = {
  promptCount: number;
  salesCount: number;
  earnings: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ promptCount: 0, salesCount: 0, earnings: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentSales, setRecentSales] = useState<PurchaseRow[]>([]);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);

  const overviewCards = useMemo(
    () => [
      { label: 'Prompts Uploaded', value: stats.promptCount.toString() },
      { label: 'Total Sales', value: stats.salesCount.toString() },
      { label: 'Total Earnings', value: `$${stats.earnings.toFixed(2)}` },
    ],
    [stats],
  );

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        router.replace('/auth/login');
        return;
      }

      const user = sessionData.session.user;
      setEmail(user.email ?? null);

      // Fetch prompts count
      const { count: promptCount, error: promptErr } = await supabase
        .from<PromptRow>('prompts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch purchases where this user is the seller
      const { data: purchases, error: purchaseErr } = await supabase
        .from<PurchaseRow>('purchases')
        .select('id, prompt_id, amount, buyer_id, created_at, prompts(title)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch stripe account status
      const { data: profileData, error: profileErr } = await supabase
        .from<ProfileRow>('profiles')
        .select('stripe_account_id')
        .eq('id', user.id)
        .single();

      if (promptErr || purchaseErr || profileErr) {
        setError(
          promptErr?.message || purchaseErr?.message || profileErr?.message || 'Failed to load dashboard.',
        );
        setLoading(false);
        return;
      }

      const earnings =
        purchases?.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) ?? 0;

      setStats({
        promptCount: promptCount ?? 0,
        salesCount: purchases?.length ?? 0,
        earnings,
      });
      setRecentSales(purchases ?? []);
      setStripeAccountId(profileData?.stripe_account_id ?? null);
      setLoading(false);
    };

    void loadDashboard();
  }, [router]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase text-slate-500">Welcome</p>
          <h1 className="text-2xl font-semibold text-slate-900">{email || 'Loading...'}</h1>
        </div>
        <LogoutButton />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <nav className="flex flex-wrap gap-3 text-sm font-medium text-slate-700">
          <a className="rounded-lg border border-transparent px-3 py-1 hover:border-slate-200 hover:bg-slate-50" href="/dashboard/prompts">
            My Prompts
          </a>
          <a className="rounded-lg border border-transparent px-3 py-1 hover:border-slate-200 hover:bg-slate-50" href="/dashboard/upload">
            Upload Prompt
          </a>
          <a className="rounded-lg border border-transparent px-3 py-1 hover:border-slate-200 hover:bg-slate-50" href="/dashboard/payouts">
            Payouts
          </a>
          <a className="rounded-lg border border-transparent px-3 py-1 hover:border-slate-200 hover:bg-slate-50" href="/dashboard/settings">
            Settings
          </a>
        </nav>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading your dashboard...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overviewCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs uppercase text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Recent Sales</h2>
              <a className="text-sm font-semibold text-indigo-600 hover:text-indigo-700" href="/dashboard/payouts">
                View payouts
              </a>
            </div>
            {recentSales.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No sales yet.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Prompt</th>
                      <th className="px-4 py-3 text-left">Buyer</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-900">
                          {sale.prompts?.title ?? 'Prompt'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{sale.buyer_id ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {sale.amount ? `$${Number(sale.amount).toFixed(2)}` : '$0.00'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(sale.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Stripe Account</h2>
            <p className="mt-1 text-sm text-slate-600">
              {stripeAccountId ? 'Connected to Stripe.' : 'Not connected.'}
            </p>
            {stripeAccountId && (
              <p className="text-xs text-slate-500">Account ID: {stripeAccountId}</p>
            )}
            <a
              href="/dashboard/payouts"
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Manage payouts
            </a>
          </div>
        </>
      )}
    </div>
  );
}
