'use client';

import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

type PendingPrompt = {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  price: number | null;
  is_public: boolean | null;
};

type Transaction = {
  id: string;
  prompt_id: string | null;
  amount: number | null;
  buyer_id: string | null;
  seller_id: string | null;
  stripe_txn_id: string | null;
  created_at: string;
  prompts?: { title: string | null } | null;
};

type Flagged = {
  prompt_id: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
  user_id: string | null;
  prompts?: { title: string | null; user_id: string | null } | null;
};

type AdminData = {
  pendingPrompts: PendingPrompt[];
  transactions: Transaction[];
  flagged: Flagged[];
  error?: string;
};

export default function AdminClient() {
  const { user, loading } = useUser();
  const [data, setData] = useState<AdminData>({
    pendingPrompts: [],
    transactions: [],
    flagged: [],
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: 'approve' | 'reject' | 'ban'; targetId: string } | null>(null);

  useEffect(() => {
    if (!loading && user) {
      void loadData();
    }
  }, [loading, user]);

  const authorizedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Safeguard: if supabase is not initialized, surface a clear error.
    if (!supabase) {
      throw new Error(
        'Supabase client is not initialized. Check your NEXT_PUBLIC_SUPABASE_* env vars.',
      );
    }

    const client = supabase;

    const {
      data: { session },
      error: sessionError,
    } = await client.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Not authenticated');
    }

    return fetch(input, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  const loadData = async () => {
    setStatus('Loading admin data...');
    setError(null);
    try {
      const res = await authorizedFetch('/api/admin/moderation');
      const next = (await res.json()) as AdminData;
      if (!res.ok) throw new Error(next.error || 'Failed to load admin data');
      setData(next);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load admin data');
    } finally {
      setStatus(null);
    }
  };

  const handleAction = async (action: 'approve' | 'reject' | 'ban', targetId: string) => {
    setConfirm(null);
    setStatus(`${action === 'ban' ? 'Banning' : action === 'approve' ? 'Approving' : 'Rejecting'}...`);
    setError(null);
    try {
      const body =
        action === 'ban' ? { action: 'ban', userId: targetId } : { action, promptId: targetId };
      const res = await authorizedFetch('/api/admin/moderation', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      await loadData();
    } catch (err: any) {
      setError(err.message ?? 'Action failed');
    } finally {
      setStatus(null);
    }
  };

  const pendingCount = data.pendingPrompts.length;
  const flaggedCount = data.flagged.length;
  const salesCount = data.transactions.length;

  if (!user && !loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">Sign in as admin.</div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {status && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{status}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending prompts" value={pendingCount} />
        <StatCard label="Flagged" value={flaggedCount} />
        <StatCard label="Recent transactions" value={salesCount} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Pending Prompts</h2>
          <span className="text-xs text-slate-500">{pendingCount}</span>
        </div>
        {pendingCount === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No pending prompts.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.pendingPrompts.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(p.created_at).toLocaleString()} · User {p.user_id.slice(0, 6)}… ·{' '}
                    {p.price ? `$${p.price.toFixed(2)}` : 'Free'}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setConfirm({ action: 'approve', targetId: p.id })}
                    className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm({ action: 'reject', targetId: p.id })}
                    className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-800 transition hover:border-red-200 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm({ action: 'ban', targetId: p.user_id })}
                    className="rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Ban user
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Flagged Content</h2>
          <span className="text-xs text-slate-500">{flaggedCount}</span>
        </div>
        {flaggedCount === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No flagged items.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.flagged.map((f, idx) => (
              <li key={`${f.prompt_id}-${idx}`} className="rounded-xl border border-slate-200 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    {f.prompts?.title ?? 'Prompt'} (rating {f.rating ?? '?'})
                  </span>
                  <span className="text-xs text-slate-500">{new Date(f.created_at).toLocaleString()}</span>
                </div>
                {f.comment && <p className="mt-1 text-slate-700">{f.comment}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  User {f.user_id?.slice(0, 6) ?? '?'}… — Prompt owner {f.prompts?.user_id?.slice(0, 6) ?? '?'}…
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
          <span className="text-xs text-slate-500">{salesCount}</span>
        </div>
        {salesCount === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No transactions yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.transactions.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.prompts?.title ?? 'Prompt'}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleString()} · Buyer {t.buyer_id?.slice(0, 6) ?? '?'}… · Seller{' '}
                    {t.seller_id?.slice(0, 6) ?? '?'}…
                  </p>
                  {t.stripe_txn_id && <p className="text-xs text-slate-500">Txn {t.stripe_txn_id}</p>}
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {t.amount ? `$${Number(t.amount).toFixed(2)}` : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Confirm</h3>
            <p className="mt-2 text-sm text-slate-700">
              Are you sure you want to {confirm.action} {confirm.action === 'ban' ? 'this user' : 'this prompt'}?
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(confirm.action, confirm.targetId)}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
