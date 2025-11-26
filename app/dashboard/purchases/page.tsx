'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase-client';

type PurchaseRow = {
  id: string;
  prompt_id: string | null;
  amount: number | null;
  created_at: string;
  prompts: {
    title: string | null;
    price: number | null;
    category: string | null;
  } | null;
};

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      const { data, error: fetchError } = await supabase
        .from<PurchaseRow>('purchases')
        .select('id, prompt_id, amount, created_at, prompts(title, price, category)')
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setPurchases(data ?? []);
      setLoading(false);
    };

    void load();
  }, [router]);

  const formatPrice = (row: PurchaseRow) => {
    const price = row.prompts?.price ?? row.amount ?? 0;
    return `$${Number(price || 0).toFixed(2)}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Unknown date';
    return d.toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Your Purchases</h1>
        <p className="mt-2 text-sm text-slate-600">View and access prompts you&apos;ve bought.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0">
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="h-8 w-28 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">You haven&apos;t purchased any prompts yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ul className="divide-y divide-slate-100">
            {purchases.map((purchase) => (
              <li key={purchase.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {purchase.prompts?.title || 'Prompt'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{formatDate(purchase.created_at)}</span>
                    {purchase.prompts?.category && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{purchase.prompts.category}</span>
                      </>
                    )}
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{formatPrice(purchase)}</span>
                  </div>
                </div>
                {purchase.prompt_id && (
                  <a
                    href={`/prompt/${purchase.prompt_id}/delivery`}
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Open Prompt
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
