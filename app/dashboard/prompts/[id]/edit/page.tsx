'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { supabase } from '@/lib/supabase-client';

type PromptRow = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  prompt_text: string;
};

export default function PromptEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [prompt, setPrompt] = useState<PromptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return;
      setLoading(true);
      setError(null);
      setForbidden(false);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (sessionError || !userId) {
        router.replace('/auth/login');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from<PromptRow>('prompts')
        .select('id, user_id, title, description, category, price, prompt_text')
        .eq('id', params.id)
        .single();

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Prompt not found.');
        setLoading(false);
        return;
      }

      if (data.user_id !== userId) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      setPrompt(data);
      setTitle(data.title);
      setDescription(data.description ?? '');
      setCategory(data.category ?? '');
      setPrice(data.price != null ? String(data.price) : '');
      setContent(data.prompt_text);
      setLoading(false);
    };

    void load();
  }, [params?.id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params?.id) return;
    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || null,
      price: price ? Number(price) : 0,
      prompt_text: content,
    };

    const res = await fetch(`/api/prompts/${params.id}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      setError(data?.error ?? 'Failed to save prompt.');
      setSaving(false);
      return;
    }

    router.push(`/prompts/${params.id}`);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading prompt...</p>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          <p className="font-semibold">403 — You do not have permission to edit this prompt.</p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/dashboard/prompts"
              className="inline-flex items-center rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              Back to my prompts
            </Link>
            <Link
              href={`/prompts/${params?.id ?? ''}`}
              className="inline-flex items-center rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              View prompt
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Prompt not found.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Edit Prompt</p>
          <h1 className="text-3xl font-semibold text-slate-900">{prompt.title}</h1>
        </div>
        <Link
          href={`/prompts/${prompt.id}`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View prompt
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-semibold text-slate-800" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-sm font-semibold text-slate-800" htmlFor="category">
              Category
            </label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-semibold text-slate-800" htmlFor="price">
              Price
            </label>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm font-semibold text-slate-800" htmlFor="content">
              Prompt Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/prompts"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
