'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase-client';

type PromptRow = {
  id: string;
  title: string;
  category: string | null;
  price: number | null;
  created_at: string;
  user_id: string;
};

export default function DashboardPromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setUserId(currentUserId);

      const { data, error: promptErr } = await supabase
        .from<PromptRow>('prompts')
        .select('id, title, category, price, created_at, user_id')
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this prompt?')) return;
    const { error: deleteErr } = await supabase.from('prompts').delete().eq('id', id);
    if (deleteErr) {
      alert(deleteErr.message);
      return;
    }
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    setSuccess('Prompt deleted.');
    setTimeout(() => setSuccess(null), 2500);
  };

  const handleEdit = (id: string) => {
    router.push(`/dashboard/prompts/${id}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Dashboard</p>
          <h1 className="text-2xl font-semibold text-slate-900">My Prompts</h1>
          <p className="text-sm text-slate-600">Manage your uploaded prompts.</p>
        </div>
        <a
          href="/dashboard/upload"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Upload New
        </a>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading your prompts...
        </div>
      ) : sortedPrompts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          You have not uploaded any prompts yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Price</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sortedPrompts.map((prompt) => (
                <tr key={prompt.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{prompt.title}</td>
                  <td className="px-4 py-3 text-slate-700">{prompt.category ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {prompt.price ? `$${Number(prompt.price).toFixed(2)}` : 'Free'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(prompt.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(prompt.id)}
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(prompt.id)}
                        className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
