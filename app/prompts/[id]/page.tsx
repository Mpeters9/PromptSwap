import { notFound } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import ClientSections, { ActionPanel } from './ClientSections';

export type Prompt = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  prompt_text: string;
  tags: string[] | null;
  price: number | null;
  preview_image: string | null;
  is_public: boolean | null;
  created_at: string;
};

export type Rating = {
  user_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

export type PromptVersion = {
  id: string;
  prompt_id: string;
  user_id: string | null;
  content: string | null;
  notes: string | null;
  created_at: string;
};

async function getPrompt(id: string) {
  const { data, error } = await supabase
    .from('prompts')
    .select('id, user_id, title, description, prompt_text, tags, price, preview_image, is_public, created_at')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Prompt;
}

async function getRatings(promptId: string): Promise<Rating[]> {
  const { data, error } = await supabase
    .from('prompt_ratings')
    .select('user_id, rating, comment, created_at')
    .eq('prompt_id', promptId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Rating[];
}

async function getSalesCount(promptId: string): Promise<number> {
  const { count, error } = await supabase
    .from('prompt_sales')
    .select('id', { head: true, count: 'exact' })
    .eq('prompt_id', promptId);
  if (error || !count) return 0;
  return count;
}

async function getVersions(promptId: string): Promise<PromptVersion[]> {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('id, prompt_id, user_id, content, notes, created_at')
    .eq('prompt_id', promptId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as PromptVersion[];
}

export default async function PromptDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [prompt, ratings, salesCount, versions] = await Promise.all([
    getPrompt(id),
    getRatings(id),
    getSalesCount(id),
    getVersions(id),
  ]);

  if (!prompt || prompt.is_public === false) {
    notFound();
  }

  const averageRating =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratings.length
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <main className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {prompt.preview_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prompt.preview_image}
                alt={prompt.title}
                className="h-72 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-72 items-center justify-center bg-slate-50 text-sm text-slate-400">
                No preview image
              </div>
            )}
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">{prompt.title}</h1>
                  <p className="mt-1 text-sm text-slate-500">Added {new Date(prompt.created_at).toLocaleDateString()}</p>
                  <p className="text-sm text-slate-600">Created by {prompt.user_id ?? 'Unknown creator'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {averageRating !== null && (
                    <div className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                      <span aria-hidden="true">★</span>
                      <span>{averageRating.toFixed(1)}</span>
                      <span className="text-xs text-amber-600">({ratings.length})</span>
                    </div>
                  )}
                  <div className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                    {prompt.price && prompt.price > 0 ? `$${prompt.price.toFixed(2)}` : 'Free'}
                  </div>
                </div>
              </div>

              {prompt.tags && prompt.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {prompt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-base text-slate-700 whitespace-pre-line">{prompt.description}</p>

              <div className="rounded-xl bg-slate-50 p-4">
                <h2 className="text-sm font-semibold text-slate-900">Prompt Text</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{prompt.prompt_text}</p>
              </div>
            </div>
          </div>

          <ClientSections prompt={prompt} ratings={ratings} />
        </main>

        <aside className="space-y-4">
          <ActionPanel prompt={prompt} salesCount={salesCount} averageRating={averageRating} ratingCount={ratings.length} />
          <VersionsCard versions={versions} latestContent={prompt.prompt_text} />
        </aside>
      </div>
    </div>
  );
}

type VersionsCardProps = {
  versions: PromptVersion[];
  latestContent: string;
};

function VersionsCard({ versions, latestContent }: VersionsCardProps) {
  if (!versions.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Versions</h3>
        <p className="mt-2 text-sm text-slate-600">No versions yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Versions</h3>
      <ul className="mt-4 space-y-3">
        {versions.map((version) => (
          <li key={version.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-900">
                {new Date(version.created_at).toLocaleString()}
              </div>
              <VersionDiff latestContent={latestContent} content={version.content ?? ''} />
            </div>
            {version.notes && <p className="mt-2 text-slate-700">{version.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersionDiff({ latestContent, content }: { latestContent: string; content: string }) {
  return (
    <details className="text-xs text-indigo-700">
      <summary className="cursor-pointer select-none">View diff</summary>
      <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 text-slate-700">
        <div>
          <div className="font-semibold text-slate-800">Current</div>
          <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[11px] leading-relaxed text-slate-700">
            {latestContent}
          </pre>
        </div>
        <div>
          <div className="font-semibold text-slate-800">This version</div>
          <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[11px] leading-relaxed text-slate-700">
            {content}
          </pre>
        </div>
      </div>
    </details>
  );
}
