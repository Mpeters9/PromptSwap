import Link from 'next/link';

import { supabase } from '@/lib/supabase';

type PromptRow = {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  price: number | null;
  preview_image: string | null;
  created_at: string;
};

type PopularityCount = {
  prompt_id: string;
  count: number | null;
};

type PromptWithPopularity = PromptRow & { popularity: number };

async function fetchPrompts(): Promise<{ prompts: PromptRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('prompts')
    .select('id, title, description, tags, price, preview_image, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    return { prompts: [], error: error.message };
  }

  return { prompts: data ?? [] };
}

async function fetchPopularity(): Promise<Record<string, number>> {
  const popularity: Record<string, number> = {};

  const [{ data: ratings }, { data: tests }] = await Promise.all([
    supabase
      .from('prompt_ratings')
      .select('prompt_id, count:prompt_id', { group: 'prompt_id' }) as Promise<{
        data: PopularityCount[] | null;
      }>,
    supabase
      .from('test_runs')
      .select('prompt_id, count:prompt_id', { group: 'prompt_id' }) as Promise<{
        data: PopularityCount[] | null;
      }>,
  ]);

  ratings?.forEach(({ prompt_id, count }) => {
    popularity[prompt_id] = (popularity[prompt_id] ?? 0) + (count ?? 0);
  });

  tests?.forEach(({ prompt_id, count }) => {
    popularity[prompt_id] = (popularity[prompt_id] ?? 0) + (count ?? 0);
  });

  return popularity;
}

function applyFilters(
  prompts: PromptWithPopularity[],
  params: { q: string; price: string; sort: string },
): PromptWithPopularity[] {
  const query = params.q.trim().toLowerCase();
  const filtered = prompts.filter((p) => {
    const matchesQuery =
      !query ||
      p.title.toLowerCase().includes(query) ||
      (p.tags ?? []).some((tag) => tag.toLowerCase().includes(query));

    const matchesPrice =
      params.price === 'all'
        ? true
        : params.price === 'free'
          ? !p.price || p.price <= 0
          : !!p.price && p.price > 0;

    return matchesQuery && matchesPrice;
  });

  if (params.sort === 'popular') {
    return filtered.sort((a, b) => b.popularity - a.popularity || Date.parse(b.created_at) - Date.parse(a.created_at));
  }

  return filtered.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

function formatPrice(price: number | null) {
  if (!price || price <= 0) return 'Free';
  return `$${price.toFixed(2)}`;
}

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function PromptsPage({ searchParams }: PageProps) {
  const q = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const price = typeof searchParams?.price === 'string' ? searchParams.price : 'all';
  const sort = typeof searchParams?.sort === 'string' ? searchParams.sort : 'newest';

  const [{ prompts, error }, popularityMap] = await Promise.all([fetchPrompts(), fetchPopularity()]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load prompts: {error}
        </div>
      </div>
    );
  }

  const promptsWithPopularity: PromptWithPopularity[] = prompts.map((p) => ({
    ...p,
    popularity: popularityMap[p.id] ?? 0,
  }));

  const filtered = applyFilters(promptsWithPopularity, { q, price, sort });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Prompt Marketplace</h1>
          <p className="mt-2 text-sm text-slate-600">
            Discover, search, and filter community prompts.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Upload Prompt
        </Link>
      </header>

      <form className="mt-8 grid gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-4 sm:items-center">
        <div className="sm:col-span-2">
          <label className="sr-only" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search by title or tags..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="sr-only" htmlFor="price">
            Price filter
          </label>
          <select
            id="price"
            name="price"
            defaultValue={price}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All prices</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most popular</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            Apply
          </button>
        </div>
      </form>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-lg border border-slate-200 bg-white px-6 py-10 text-center text-slate-600">
          No prompts found. Try adjusting your search or filters.
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((prompt) => (
            <Link
              key={prompt.id}
              href={`/prompts/${prompt.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <div className="relative h-40 bg-gradient-to-br from-indigo-50 to-slate-100">
                {prompt.preview_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={prompt.preview_image}
                    alt={prompt.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    No preview
                  </div>
                )}
                <div className="absolute left-3 top-3 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                  {formatPrice(prompt.price)}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 text-base font-semibold text-slate-900 group-hover:text-indigo-700">
                    {prompt.title}
                  </h2>
                  {prompt.popularity > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                      {prompt.popularity} hits
                    </span>
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
                <div className="text-xs text-slate-500">
                  Added {new Date(prompt.created_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
