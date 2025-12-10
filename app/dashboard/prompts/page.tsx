'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import PromptCard from '@/components/PromptCard';
import { supabase } from '@/lib/supabase-client';

type PromptRow = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  created_at: string;
  user_id: string;
};

export default function DashboardPromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const sortedPrompts = useMemo(
    () =>
      [...prompts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [prompts],
  );

  useEffect(() => {
    const loadPrompts = async () => {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        router.replace('/auth/login');
        return;
      }

      const currentUserId = sessionData.session.user.id;

        const { data, error: promptErr } = await supabase
          .from('prompts')
          .select('id, title, description, price, created_at, user_id')
          .eq('user_id', currentUserId);

      if (promptErr) {
        setError(promptErr.message);
        setLoading(false);
        return;
      }

      setPrompts(data ?? []);
      setLoading(false);
    };

    void loadPrompts();
  }, [router]);

  const handleCopy = async (id: string) => {
    try {
      const url = `${window.location.origin}/prompts/${id}`;
      await navigator.clipboard.writeText(url);
      setCopyMessage('Link copied to clipboard');
      setTimeout(() => setCopyMessage(null), 2000);
    } catch (err: any) {
      setCopyMessage(err?.message ?? 'Copy failed');
      setTimeout(() => setCopyMessage(null), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Dashboard</p>
          <h1 className="text-2xl font-semibold text-slate-900">My Prompts</h1>
          <p className="text-sm text-slate-600">Manage your uploaded prompts.</p>
        </div>
        <Link
          href="/dashboard/upload"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Upload New
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {copyMessage && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          {copyMessage}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-full flex-col gap-4 animate-pulse">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-2/3 rounded bg-slate-200" />
                    <div className="h-4 w-full rounded bg-slate-200" />
                    <div className="h-4 w-5/6 rounded bg-slate-200" />
                  </div>
                  <div className="h-6 w-16 rounded bg-slate-200" />
                </div>
                <div className="mt-auto flex items-center justify-between text-xs">
                  <div className="h-4 w-24 rounded bg-slate-200" />
                  <div className="h-4 w-16 rounded bg-slate-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sortedPrompts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          You have not uploaded any prompts yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {sortedPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <PromptCard
                id={prompt.id}
                title={prompt.title}
                description={prompt.description ?? ''}
                price={Number(prompt.price ?? 0)}
                authorName="You"
              />
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/prompts/${prompt.id}`}
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Edit
                </Link>
                <Link
                  href={`/prompts/${prompt.id}`}
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => handleCopy(prompt.id)}
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Copy Link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
