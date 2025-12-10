'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

type Prompt = {
  id: string;
  title: string;
  price: number | null;
  created_at: string;
  preview_image: string | null;
};

type Sale = {
  id: string;
  prompt_id: string | null;
  amount: number | null;
  created_at: string;
  stripe_txn_id: string | null;
  prompts: { title: string | null } | null;
};

type SavedPrompt = {
  prompt_id: string;
  prompts: Prompt | null;
};

type Profile = {
  stripe_account_id: string | null;
};

export default function ClientDashboard() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [creatorPrompts, setCreatorPrompts] = useState<Prompt[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user]);

  const loadData = async () => {
    const userId = user?.id;
    if (!userId) return;

    setStatus('Loading dashboard data...');
    setError(null);
    try {
      const [promptRes, salesRes, savedRes, profileRes] = await Promise.all([
        supabase
          .from('prompts')
          .select('id, title, price, created_at, preview_image')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('prompt_sales')
          .select('id, prompt_id, amount, created_at, stripe_txn_id, prompts(title)')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          // Adjust this table name/fields to your saved prompts table.
          .from('saved_prompts')
          .select('prompt_id, prompts(id, title, price, created_at, preview_image)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('profiles').select('stripe_account_id').eq('id', userId).single(),
      ]);

      if (promptRes.error) throw promptRes.error;
      if (salesRes.error) throw salesRes.error;
      if (savedRes.error) {
        console.warn('Saved prompts fetch failed (table may not exist):', savedRes.error);
      }
      if (profileRes.error) {
        console.warn('Profile fetch failed (table may not exist):', profileRes.error);
      }

      setCreatorPrompts(promptRes.data ?? []);
      setSales(salesRes.data ?? []);
      setSavedPrompts(savedRes.data ?? []);
      setProfile(profileRes.data ?? null);
      setStatus(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Failed to load dashboard.');
      setStatus(null);
    }
  };

  const totalEarnings = useMemo(
    () => sales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0),
    [sales],
  );
  const recentEarnings = useMemo(() => {
    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    return sales
      .filter((s) => new Date(s.created_at).getTime() >= oneMonthAgo)
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  }, [sales]);
  const salesCount = sales.length;
  const isCreator = !!profile?.stripe_account_id;

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Delete this prompt?')) return;
    const { error: deleteError } = await supabase.from('prompts').delete().eq('id', id);
    if (deleteError) {
      alert(deleteError.message);
      return;
    }
    setCreatorPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        Redirecting to sign in...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {status && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {status}
        </div>
      )}

      <StatsRow totalEarnings={totalEarnings} recentEarnings={recentEarnings} salesCount={salesCount} isCreator={isCreator} />

      {isCreator && (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <MyPromptsSection prompts={creatorPrompts} onDelete={handleDeletePrompt} />
          <QuickActions />
        </div>
      )}

      <SalesSection sales={sales} />
      <SavedPromptsSection saved={savedPrompts} />
    </div>
  );
}

function StatsRow({
  totalEarnings,
  recentEarnings,
  salesCount,
  isCreator,
}: {
  totalEarnings: number;
  recentEarnings: number;
  salesCount: number;
  isCreator: boolean;
}) {
  const cards = [
    { label: 'Total Earnings', value: `$${totalEarnings.toFixed(2)}` },
    { label: 'Last 30 Days', value: `$${recentEarnings.toFixed(2)}` },
    { label: 'Sales', value: `${salesCount}` },
    { label: 'Creator Status', value: isCreator ? 'Connected' : 'Not connected' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function MyPromptsSection({ prompts, onDelete }: { prompts: Prompt[]; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">My Prompts</h2>
        <a
          href="/upload"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          + New
        </a>
      </div>
      {prompts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No prompts yet. Upload your first prompt.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {prompts.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                <p className="text-xs text-slate-500">
                  {new Date(p.created_at).toLocaleDateString()} · {p.price ? `$${p.price.toFixed(2)}` : 'Free'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <a className="text-indigo-600 hover:text-indigo-700" href={`/prompts/${p.id}`}>
                  View
                </a>
                <a className="text-slate-600 hover:text-slate-800" href={`/prompts/${p.id}/edit`}>
                  Edit
                </a>
                <a className="text-slate-600 hover:text-slate-800" href={`/dashboard/sales?promptId=${p.id}`}>
                  Sales
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickActions() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-md font-semibold text-slate-900">Quick Actions</h3>
      <ul className="mt-4 space-y-3 text-sm text-slate-700">
        <li>
          <a className="text-indigo-600 hover:text-indigo-700" href="/dashboard/connect-stripe">
            Connect Stripe
          </a>
          <p className="text-xs text-slate-500">Enable payouts and become a creator.</p>
        </li>
        <li>
          <a className="text-indigo-600 hover:text-indigo-700" href="/upload">
            Upload a prompt
          </a>
          <p className="text-xs text-slate-500">Share your prompt with buyers.</p>
        </li>
        <li>
          <a className="text-indigo-600 hover:text-indigo-700" href="/prompts">
            Explore marketplace
          </a>
          <p className="text-xs text-slate-500">See what others are building.</p>
        </li>
      </ul>
    </div>
  );
}

function SalesSection({ sales }: { sales: Sale[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Recent Sales</h2>
        <a className="text-sm font-medium text-indigo-600 hover:text-indigo-700" href="/dashboard/sales">
          View all
        </a>
      </div>
      {sales.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No sales yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sales.map((sale) => (
            <li key={sale.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {sale.prompts?.title || 'Prompt'}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(sale.created_at).toLocaleString()} · {sale.stripe_txn_id ? `Txn: ${sale.stripe_txn_id}` : 'Pending'}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {sale.amount ? `$${Number(sale.amount).toFixed(2)}` : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedPromptsSection({ saved }: { saved: SavedPrompt[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Saved Prompts</h2>
        <a className="text-sm font-medium text-indigo-600 hover:text-indigo-700" href="/prompts">
          Browse more
        </a>
      </div>
      {saved.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No saved prompts yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {saved.map((item) => (
            <li
              key={item.prompt_id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.prompts?.title ?? 'Prompt'}</p>
                <p className="text-xs text-slate-500">
                  {item.prompts?.price ? `$${item.prompts.price.toFixed(2)}` : 'Free'}
                </p>
              </div>
              <a className="text-sm font-medium text-indigo-600 hover:text-indigo-700" href={`/prompts/${item.prompt_id}`}>
                View
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
