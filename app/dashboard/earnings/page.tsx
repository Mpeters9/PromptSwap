import { redirect } from 'next/navigation';

import { getUser } from '@/lib/auth';

// TODO: Replace with real Stripe dashboard link for your account.
const STRIPE_DASHBOARD_URL = 'https://dashboard.stripe.com/';

async function getEarnings(userId: string) {
  // Placeholder: replace with real data source (Prisma/Supabase) aggregating orders.
  // Returning zeros to avoid throwing until the data source is wired up.
  return {
    total: 0,
    pending: 0,
  };
}

export default async function EarningsPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const earnings = await getEarnings(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Earnings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Track your total earnings and manage payouts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Total Earnings</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            ${Number(earnings.total ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Pending Balance</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            ${Number(earnings.pending ?? 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-900">Manage your payouts</p>
            <p className="text-xs text-indigo-700">
              Visit Stripe to view balances, transfers, and payouts.
            </p>
          </div>
          <a
            href={STRIPE_DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Go to Stripe Payouts
          </a>
        </div>
      </div>
    </div>
  );
}
