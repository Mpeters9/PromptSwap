import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { PromptCard } from '@/components/PromptCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const prisma = new PrismaClient();

type MarketplaceProps = {
  searchParams?: { search?: string; category?: string; sort?: string };
};

export default async function MarketplacePage({ searchParams }: MarketplaceProps) {
  const search = searchParams?.search?.toString().trim() ?? '';
  const category = searchParams?.category?.toString().trim() ?? '';
  const sort = searchParams?.sort?.toString().trim() ?? 'newest';

  const orderBy =
    sort === 'priceAsc'
      ? { price: 'asc' }
      : sort === 'priceDesc'
        ? { price: 'desc' }
        : sort === 'popular'
          ? { orders: { _count: 'desc' } }
          : { createdAt: 'desc' };

  const [prompts, categories] = await Promise.all([
    prisma.prompt.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  { description: { contains: search, mode: 'insensitive' } },
                ],
              }
            : undefined,
          category ? { category } : undefined,
        ].filter(Boolean) as object[],
      },
      orderBy,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        category: true,
        tags: true,
        createdAt: true,
        user_id: true,
        likes: true,
        preview_image: true,
      },
    }),
    prisma.prompt.findMany({
      distinct: ['category'],
      where: { category: { not: null } },
      select: { category: true },
      orderBy: { category: 'asc' },
    }),
  ]);

  const categoryOptions = categories
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <motion.div
        className="mb-6 space-y-2 text-center md:text-left"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Marketplace</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Browse, filter, and purchase quality prompts.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 md:p-6">
            <form
              className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,180px,180px,120px] md:items-center"
              action="/marketplace"
              method="get"
            >
              <Input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search prompts..."
                className="w-full"
              />

              <Select name="category" defaultValue={category}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select name="sort" defaultValue={sort}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="priceAsc">Price: Low to High</SelectItem>
                  <SelectItem value="priceDesc">Price: High to Low</SelectItem>
                  <SelectItem value="popular">Popular</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Button type="submit" className="w-full">
                  Apply
                </Button>
                {(search || category || sort !== 'newest') && (
                  <Button variant="ghost" asChild className="w-full">
                    <Link href="/marketplace">Clear</Link>
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {categoryOptions.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {categoryOptions.map((cat) => {
            const isActive = cat === category;
            const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
            const sortParam = sort ? `&sort=${encodeURIComponent(sort)}` : '';
            return (
              <Badge
                key={cat}
                variant={isActive ? 'default' : 'outline'}
                className="cursor-pointer transition hover:scale-[1.02]"
                asChild
              >
                <Link href={`/marketplace?category=${encodeURIComponent(cat)}${searchParam}${sortParam}`}>
                  {cat}
                </Link>
              </Badge>
            );
          })}
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {search || category ? 'No prompts match your filters.' : 'No prompts found.'}
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
              authorName={prompt.user_id ?? 'Creator'}
              category={prompt.category ?? undefined}
              previewImage={prompt.preview_image ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
