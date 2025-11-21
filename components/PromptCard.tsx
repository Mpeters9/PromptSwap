'use client';

import { useState } from 'react';
import Link from 'next/link';

import { useUser } from '@/lib/useUser';

type Prompt = {
  id: string;
  title: string;
  description?: string | null;
  preview_image?: string | null;
  price?: number | null;
  tags?: string[] | null;
  rating?: number | null;
};

type Props = {
  prompt: Prompt;
  onSave?: (id: string) => Promise<void> | void;
  onPreviewOpen?: (id: string) => void;
};

const formatPrice = (price: number | null | undefined) => {
  if (!price || price <= 0) return 'Free';
  return `$${price.toFixed(2)}`;
};

const clamp = (value: number | null | undefined, min: number, max: number) =>
  Math.min(max, Math.max(min, value ?? 0));

export default function PromptCard({ prompt, onSave, onPreviewOpen }: Props) {
  const { user } = useUser();
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const stars = clamp(prompt.rating, 0, 5);

  const handlePreview = () => {
    onPreviewOpen?.(prompt.id);
    setPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!user || !onSave) return;
    setSaving(true);
    try {
      await onSave(prompt.id);
    } catch (err) {
      console.error('Failed to save prompt', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2">
        <button
          type="button"
          onClick={handlePreview}
          className="relative h-40 w-full bg-gradient-to-br from-indigo-50 to-slate-100 focus:outline-none"
          aria-label={`Preview ${prompt.title}`}
        >
          {prompt.preview_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prompt.preview_image}
              alt={prompt.title}
              className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No preview
            </div>
          )}
          <div className="absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm">
            {formatPrice(prompt.price ?? null)}
          </div>
        </button>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 text-base font-semibold text-slate-900 group-hover:text-indigo-700">
              {prompt.title}
            </h2>
            {stars > 0 && (
              <div className="flex items-center gap-1 text-amber-500" aria-label={`Rating ${stars} out of 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} aria-hidden="true">
                    {i < Math.round(stars) ? '★' : '☆'}
                  </span>
                ))}
              </div>
            )}
          </div>

          <p className="line-clamp-3 text-sm text-slate-600">
            {prompt.description || 'No description provided.'}
          </p>

          <div className="mt-auto flex flex-wrap gap-2">
            {(prompt.tags ?? []).slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              Preview
            </button>

            {prompt.price && prompt.price > 0 ? (
              <Link
                href={`/prompts/${prompt.id}`}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              >
                Buy
              </Link>
            ) : (
              <Link
                href={`/prompts/${prompt.id}`}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
              >
                View
              </Link>
            )}

            {user && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !onSave}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </article>

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${prompt.title}`}
        >
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 rounded-full p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Close preview"
            >
              ✕
            </button>
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold text-slate-900">{prompt.title}</h3>
              {prompt.preview_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={prompt.preview_image}
                  alt={prompt.title}
                  className="w-full rounded-xl border border-slate-200 object-cover"
                />
              ) : null}
              <p className="text-sm text-slate-700 whitespace-pre-line">
                {prompt.description || 'No description provided.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
