import Link from 'next/link';

import { PromptCard } from '@/components/PromptCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { buildMetadata } from '@/lib/metadata';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Marketplace - PromptSwap',
  description: 'Browse, filter, and purchase quality prompts on PromptSwap.',
  image: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/og`,
});

type MarketplaceProps = {
  searchParams?: Promise<{
    q?: string;
    tags?: string;
    sort?: string;
    priceMin?: string;
    priceMax?: string;
    page?: string;
  }>;
};

async function fetchPrompts(params: URLSearchParams) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/prompts/search?${params.toString()}`, {
    cache: 'no-store',
    headers: { 'x-request-id': crypto.randomUUID() },
  });

  if (!res.ok) {
    console.error('Failed to load marketplace', res.status);
    return { items: [], total: 0 };
  }

  const payload = await res.json();
  return payload?.data ?? { items: [], total: 0 };
}

export default async function MarketplacePage({ searchParams }: MarketplaceProps) {
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q?.toString().trim() ?? '';
  const tagsRaw = resolvedParams?.tags?.toString().trim() ?? '';
  const priceMin = resolvedParams?.priceMin?.toString().trim() ?? '';
  const priceMax = resolvedParams?.priceMax?.toString().trim() ?? '';
  const sort = resolvedParams?.sort?.toString().trim() ?? 'new';

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tagsRaw) params.set('tags', tagsRaw);
  if (priceMin) params.set('priceMin', priceMin);
  if (priceMax) params.set('priceMax', priceMax);
  params.set('sort', sort);

  const { items: prompts } = await fetchPrompts(params);
  const tagsList = tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-2 text-center md:text-left">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Marketplace</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Browse, filter, and purchase quality prompts.
        </p>
      </div>

      <div>
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 md:p-6">
            <form
              className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,180px,180px,120px] md:items-center"
              action="/marketplace"
              method="get"
            >
              <Input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search prompts..."
                className="w-full"
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  name="priceMin"
                  min={0}
                  step="0.01"
                  defaultValue={priceMin}
                  placeholder="Min price"
                />
                <Input
                  type="number"
                  name="priceMax"
                  min={0}
                  step="0.01"
                  defaultValue={priceMax}
                  placeholder="Max price"
                />
              </div>

              <Input
                type="text"
                name="tags"
                defaultValue={tagsRaw}
                placeholder="Tags (comma separated)"
              />

              <Select name="sort" defaultValue={sort}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Newest</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Button type="submit" className="w-full">
                  Apply
                </Button>
                {(q || tagsRaw || priceMin || priceMax || sort !== 'new') && (
                  <Button variant="ghost" asChild className="w-full">
                    <Link href="/marketplace">Clear</Link>
                  </Button>
                )}
              </div>
            </form>

            {tagsList.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {tagsList.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {prompts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {q || tagsRaw ? 'No prompts match your filters.' : 'No prompts found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              id={prompt.id}
              title={prompt.title}
              description={prompt.description ?? ''}
              price={Number(prompt.price ?? 0)}
              authorName={prompt.userId ?? 'Creator'}
              previewImage={prompt.previewImage ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
