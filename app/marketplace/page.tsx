'use client';

import { useEffect, useMemo, useState } from 'react';

import MarketplaceFilters from '@/components/MarketplaceFilters';
import PromptCard from '@/components/PromptCard';
import EmptyState from '@/components/ui/EmptyState';
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
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
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

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 200);
    return () => window.clearTimeout(id);
  }, [search]);

  const filteredPrompts = useMemo(() => {
    let result = [...prompts];
    const searchLower = debouncedSearch.toLowerCase();
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
  }, [category, debouncedSearch, prompts, selectedTags, sort]);

  const handleCategoryToggle = (value: string) => {
    setCategory((current) => (current === value ? '' : value));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Marketplace</h1>
        <p className="text-sm text-gray-600">Browse, buy, and sell high-quality prompts.</p>
      </div>

      <div className="mb-4 -mx-1 overflow-x-auto">
        <div className="flex w-full items-center gap-2 px-1">
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryToggle(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-1 text-sm border transition hover:bg-gray-200 ${
                  active ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-700'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 md:w-64"
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

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-full flex-col gap-4 animate-pulse">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-2/3 rounded bg-gray-200" />
                    <div className="h-4 w-full rounded bg-gray-200" />
                    <div className="h-4 w-5/6 rounded bg-gray-200" />
                  </div>
                  <div className="h-6 w-16 rounded bg-gray-200" />
                </div>
                <div className="mt-auto flex items-center justify-between text-xs">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                  <div className="h-4 w-16 rounded bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <EmptyState
          title="No prompts found"
          description="Try adjusting filters or search terms to discover more prompts."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              id={prompt.id}
              title={prompt.title}
              description={prompt.description ?? ''}
              price={Number(prompt.price ?? 0)}
              createdAt={prompt.created_at ? new Date(prompt.created_at) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
