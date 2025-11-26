'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

type FormState = {
  title: string;
  description: string;
  tags: string;
  price: string;
  promptText: string;
  previewFile: File | null;
};

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    tags: '',
    price: '',
    promptText: '',
    previewFile: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect unauthenticated users once auth state is known.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [loading, router, user]);

  const tagList = useMemo(
    () =>
      form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags],
  );

  const handleChange = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, previewFile: file }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);

    if (!user) {
      router.replace('/auth/sign-in');
      return;
    }

    // Client-side validation
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.promptText.trim()) {
      setError('Prompt text is required.');
      return;
    }

    const priceValue =
      form.price.trim() === '' ? null : Number.parseFloat(form.price);
    if (priceValue !== null && Number.isNaN(priceValue)) {
      setError('Price must be a number.');
      return;
    }

    setSubmitting(true);
    setStatus('Uploading preview...');

    let previewUrl: string | null = null;

    if (form.previewFile) {
      const path = `users/${user.id}/${Date.now()}-${encodeURIComponent(form.previewFile.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('prompt-images')
        .upload(path, form.previewFile, { cacheControl: '3600' });

      if (uploadError) {
        setError(`Failed to upload image: ${uploadError.message}`);
        setSubmitting(false);
        setStatus(null);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('prompt-images')
        .getPublicUrl(path);
      previewUrl = publicUrlData?.publicUrl ?? null;
    }

    setStatus('Saving prompt...');
    const { data: result, error: insertError } = await supabase
      .from('prompts')
      .insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        tags: tagList.length ? tagList : null,
        price: priceValue,
        prompt_text: form.promptText.trim(),
        preview_image: previewUrl,
        is_public: false,
      })
      .select()
      .single();

    if (!result || insertError) {
      setError(`Failed to save prompt: ${insertError?.message || 'Unknown error'}`);
      setSubmitting(false);
      setStatus(null);
      return;
    }

    // Upload prompt file to storage
    const promptTextFile = new Blob([form.promptText.trim()], { type: 'text/plain' });
    const { error: uploadPromptError } = await supabase.storage
      .from('prompts')
      .upload(`${result.id}.txt`, promptTextFile, {
        upsert: true,
      });

    if (uploadPromptError) {
      setError(`Prompt saved, but failed to upload file: ${uploadPromptError.message}`);
      setSubmitting(false);
      setStatus(null);
      return;
    }

    setStatus('Prompt created! Redirecting...');
    router.push(`/prompts/${result.id}`);
  };

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
        Redirecting to sign in...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Upload Prompt</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add your prompt details and upload an optional preview image.
        </p>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="title">
              Title *
            </label>
            <input
              id="title"
              name="title"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              value={form.title}
              onChange={handleChange('title')}
              placeholder="E.g., Product launch email prompt"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              value={form.description}
              onChange={handleChange('description')}
              placeholder="Describe what this prompt does and when to use it."
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="tags">
                Tags (comma separated)
              </label>
              <input
                id="tags"
                name="tags"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={form.tags}
                onChange={handleChange('tags')}
                placeholder="E.g., email, marketing, launch"
              />
              {tagList.length > 0 ? (
                <div className="text-xs text-slate-500">Parsed tags: {tagList.join(', ')}</div>
              ) : (
                <div className="text-xs text-slate-400">No tags added yet.</div>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="price">
                Price (optional)
              </label>
              <input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={form.price}
                onChange={handleChange('price')}
                placeholder="E.g., 5.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="promptText">
              Prompt Text *
            </label>
            <textarea
              id="promptText"
              name="promptText"
              rows={6}
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              value={form.promptText}
              onChange={handleChange('promptText')}
              placeholder="Full prompt content..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="preview">
              Preview Image (optional)
            </label>
            <input
              id="preview"
              name="preview"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:border-indigo-200"
            />
            {form.previewFile && (
              <div className="text-xs text-slate-500">
                Selected: {form.previewFile.name} ({Math.round(form.previewFile.size / 1024)} KB)
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {status && !error && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
              {status}
            </div>
          )}

          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {submitting ? 'Uploading...' : 'Publish Prompt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
