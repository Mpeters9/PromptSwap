'use client';

import { useMemo } from 'react';

type SortOption = 'price-asc' | 'price-desc' | 'newest';

type MarketplaceFiltersProps = {
  categories: string[];
  tags: string[];
  category: string;
  selectedTags: string[];
  sort: SortOption;
  onCategoryChange: (value: string) => void;
  onTagsChange: (values: string[]) => void;
  onSortChange: (value: SortOption) => void;
};

export default function MarketplaceFilters({
  categories,
  tags,
  category,
  selectedTags,
  sort,
  onCategoryChange,
  onTagsChange,
  onSortChange,
}: MarketplaceFiltersProps) {
  const tagSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const toggleTag = (tag: string) => {
    const next = new Set(tagSet);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    onTagsChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:w-48"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm md:w-64">
        <p className="text-xs font-semibold text-slate-600">Tags</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                tagSet.has(tag)
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-transparent'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:w-48"
      >
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low → High</option>
        <option value="price-desc">Price: High → Low</option>
      </select>
    </div>
  );
}
