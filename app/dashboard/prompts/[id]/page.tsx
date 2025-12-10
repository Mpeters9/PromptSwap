'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase-client';

type PromptRow = {
  id: string;
  title: string;
  description: string;
  prompt_text: string;
  price: number | null;
  category: string | null;
  tags: string[] | null;
  user_id: string;
};

type FormState = {
  title: string;
  description: string;
  promptText: string;
  price: string;
  category: string;
  tags: string[];
};

const categories = ['General', 'Marketing', 'Writing', 'Code', 'Research', 'Other'];

export default function EditPromptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    promptText: '',
    price: '',
    category: categories[0],
    tags: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

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

        const { data, error: fetchErr } = await supabase
          .from('prompts')
          .select('id, title, description, prompt_text, price, category, tags, user_id')
          .eq('id', params.id)
          .single();

      if (fetchErr) {
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      if (data.user_id !== userId) {
        setError('You do not have permission to edit this prompt.');
        setLoading(false);
        return;
      }

      setOwnerId(userId);
      setForm({
        title: data.title,
        description: data.description,
        promptText: data.prompt_text,
        price: data.price !== null ? String(data.price) : '',
        category: data.category ?? categories[0],
        tags: data.tags ?? [],
      });
      setLoading(false);
    };

    if (params?.id) {
      void load();
    }
  }, [params?.id, router]);

  const handleChange = (key: keyof FormState) => (value: string | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => {
      const next = new Set(prev.tags);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return { ...prev, tags: Array.from(next) };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const { title, description, promptText, price, category, tags } = form;
    if (!title.trim() || !description.trim() || !promptText.trim()) {
      setError('Title, description, and prompt text are required.');
      setSaving(false);
      return;
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError('Price must be a non-negative number.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('prompts')
      .update({
        title: title.trim(),
        description: description.trim(),
        prompt_text: promptText.trim(),
        price: numericPrice,
        category: category || null,
        tags: tags.length ? tags : null,
      })
      .eq('id', params.id)
      .eq('user_id', ownerId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess('Prompt updated.');
    setTimeout(() => router.push('/dashboard/prompts'), 800);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this prompt?')) return;
    const { error: deleteErr } = await supabase
      .from('prompts')
      .delete()
      .eq('id', params.id)
      .eq('user_id', ownerId);
    if (deleteErr) {
      setError(deleteErr.message);
      return;
    }
    router.push('/dashboard/prompts');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Edit Prompt</h1>
        <p className="text-sm text-slate-600">Update your prompt details.</p>
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
          Loading prompt...
        </div>
      ) : ownerId ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={form.title}
                onChange={(e) => handleChange('title')(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                required
                value={form.description}
                onChange={(e) => handleChange('description')(e.target.value)}
                className="mt-1 h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="prompt_text">
                Prompt Text
              </label>
              <textarea
                id="prompt_text"
                name="prompt_text"
                required
                value={form.promptText}
                onChange={(e) => handleChange('promptText')(e.target.value)}
                className="mt-1 h-40 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="category">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={(e) => handleChange('category')(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="price">
                  Price (USD)
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => handleChange('price')(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {['ai', 'marketing', 'writing', 'coding', 'productivity', 'design', 'research'].map(
                  (tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        form.tags.includes(tag)
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {tag}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/prompts')}
                className="text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
