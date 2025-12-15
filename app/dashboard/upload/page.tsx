'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';


import { supabase } from '@/lib/supabase/client';

type FormState = {
  title: string;
  description: string;
  promptText: string;
  price: string;
  category: string;
  tags: string;
};

const categories = ['General', 'Marketing', 'Writing', 'Code', 'Research', 'Other'];

export default function UploadPromptPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    promptText: '',
    price: '',
    category: categories[0],
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { title, description, promptText, price, category, tags } = form;

    if (!title.trim() || !description.trim() || !promptText.trim()) {
      setError('Title, description, and prompt text are required.');
      setLoading(false);
      return;
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setError('Price must be a non-negative number.');
      setLoading(false);
      return;
    }

    const tagsArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      setError('You must be logged in to upload a prompt.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('prompts').insert({
      title: title.trim(),
      description: description.trim(),
      prompt_text: promptText.trim(),
      tags: tagsArray.length ? tagsArray : null,
      price: numericPrice,
      category: category || null,
      user_id: sessionData.session.user.id,
    });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess('Prompt published!');
    setTimeout(() => router.push('/dashboard/prompts'), 1000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Upload a Prompt</h1>
        <p className="text-sm text-slate-600">Add details below to list your prompt.</p>
      </div>

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
              placeholder="Catchy prompt title"
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
              placeholder="What does this prompt do? Who is it for?"
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
              placeholder="Paste the exact prompt buyers will receive."
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
                placeholder="5.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="tags">
              Tags (comma separated)
            </label>
            <input
              id="tags"
              name="tags"
              type="text"
              value={form.tags}
              onChange={(e) => handleChange('tags')(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="ai, marketing, automation"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {loading ? 'Saving...' : 'Publish prompt'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
