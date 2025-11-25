'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import MarketplaceFilters from '@/components/MarketplaceFilters';
import { PromptCard } from '@/components/prompt-card';
import { supabase } from '@/lib/supabase-client';

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  tags: string[] | null;
  category: string | null;
  created_at: string;
};

type SortOption = 'price-asc' | 'price-desc' | 'newest';

export default function MarketplacePage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>('newest');

  useEffect(() => {
    const fetchPrompts = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('prompts')
        .select('id, title, description, price, tags, category, created_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setPrompts(data ?? []);
      }
      setLoading(false);
    };

    void fetchPrompts();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [prompts]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => {
      (p.tags ?? []).forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    let result = [...prompts];
    const searchLower = search.toLowerCase();
    if (searchLower) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          (p.description ?? '').toLowerCase().includes(searchLower),
      );
    }
    if (category) {
      result = result.filter((p) => p.category === category);
    }
    if (selectedTags.length > 0) {
      result = result.filter((p) => {
        const t = p.tags ?? [];
        return selectedTags.every((tag) => t.includes(tag));
      });
    }

    result.sort((a, b) => {
      if (sort === 'price-asc') {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      }
      if (sort === 'price-desc') {
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      }
      // newest (default)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [category, prompts, search, selectedTags, sort]);

  const handleCardClick = (id: string) => {
    router.push(`/marketplace/${id}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Marketplace</h1>
          <p className="text-sm text-slate-600">Browse prompts from the community.</p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:w-64"
          />
          <MarketplaceFilters
            categories={categories}
            tags={tags}
            category={category}
            selectedTags={selectedTags}
            sort={sort}
            onCategoryChange={setCategory}
            onTagsChange={setSelectedTags}
            onSortChange={setSort}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Loading prompts...
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          No prompts found.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              id={prompt.id}
              title={prompt.title}
              description={prompt.description}
              price={prompt.price}
              category={prompt.category}
              tags={prompt.tags}
            />
          ))}
        </div>
      )}
    </div>
  );
}
