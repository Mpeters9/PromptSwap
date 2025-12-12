// app/prompts/page.tsx
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase-server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchParams = {
  q?: string | string[];
  priceFilter?: string | string[];
  minPrice?: string | string[];
  maxPrice?: string | string[];
  minRating?: string | string[];
  tag?: string | string[];
  sort?: string | string[];
};

export const dynamic = "force-dynamic";

export default async function PromptsIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id ?? null;

  const safeFetch = async <T,>(fn: () => Promise<T>, fallback: T, label: string) => {
    try {
      return await fn();
    } catch (error) {
      console.error(`[prompts] ${label} failed`, error);
      return fallback;
    }
  };

  // ---- Read search params (normalize to strings) ----
  const q = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q.trim() : "";
  const priceFilter =
    typeof resolvedSearchParams.priceFilter === "string"
      ? resolvedSearchParams.priceFilter
      : "all";
  const minPriceRaw =
    typeof resolvedSearchParams.minPrice === "string" ? resolvedSearchParams.minPrice : "";
  const maxPriceRaw =
    typeof resolvedSearchParams.maxPrice === "string" ? resolvedSearchParams.maxPrice : "";
  const minRatingRaw =
    typeof resolvedSearchParams.minRating === "string" ? resolvedSearchParams.minRating : "";
  const tag = typeof resolvedSearchParams.tag === "string" ? resolvedSearchParams.tag.trim() : "";
  const sort =
    typeof resolvedSearchParams.sort === "string" ? resolvedSearchParams.sort : "latest";

  const minPrice = minPriceRaw ? parseFloat(minPriceRaw) : undefined;
  const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : undefined;
  const minRating = minRatingRaw ? parseFloat(minRatingRaw) : undefined;

  // ---- Build Prisma `where` filters (except minRating, which we apply after) ----
  const where: any = {
    isPublic: true,
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (tag) {
    // single tag filter for now; later you can expand to comma-separated list
    where.tags = { has: tag };
  }

  // Price filter
  if (priceFilter === "free") {
    where.price = { equals: 0 };
  } else if (priceFilter === "paid") {
    where.price = { gt: 0 };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {
      ...(where.price || {}),
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    };
  }

  // DB-level ordering (we'll do more advanced sorting in JS after we have aggregates)
  let orderBy: any = { createdAt: "desc" };
  if (sort === "price_asc") {
    orderBy = { price: "asc" };
  } else if (sort === "price_desc") {
    orderBy = { price: "desc" };
  }

  // ---- Fetch prompts + aggregates in parallel ----
  // All of this is best-effort so Prisma connection pool hiccups
  // don't crash the marketplace page.
  let prompts: any[] = [];
  let purchaseGroups: any[] = [];
  let userPurchases: any[] = [];
  let ratingGroups: any[] = [];

  prompts = await safeFetch(
    () =>
      prisma.prompt.findMany({
        where,
        orderBy,
        take: 200, // keep the query bounded to avoid overwhelming the pool
      }),
    [],
    "prompts",
  );

  purchaseGroups = await safeFetch(
    () =>
      prisma.purchase.groupBy({
        by: ["promptId"],
        _count: { promptId: true },
      }),
    [],
    "purchase groupBy",
  );

  ratingGroups = await safeFetch(
    () =>
      prisma.promptRating.groupBy({
        by: ["promptId"],
        _avg: { rating: true },
        _count: { rating: true },
      }),
    [],
    "rating groupBy",
  );

  userPurchases = currentUserId
    ? await safeFetch(
        () =>
          prisma.purchase.findMany({
            where: {
              buyerId: currentUserId,
            },
            select: { promptId: true },
          }),
        [],
        "user purchases",
      )
    : [];

  // Maps for quick lookup: sales & ownership
  const salesByPromptId = new Map<number, number>();
  for (const row of purchaseGroups) {
    salesByPromptId.set(row.promptId, row._count.promptId);
  }

  const ownedPromptIds = new Set<number>();
  for (const purchase of userPurchases) {
    ownedPromptIds.add(purchase.promptId);
  }

  // Rating stats map
  const ratingStatsByPromptId = new Map<
    number,
    { avg: number | null; count: number }
  >();
  for (const row of ratingGroups) {
    if (!row.promptId) continue;
    ratingStatsByPromptId.set(row.promptId, {
      avg: row._avg.rating ?? null,
      count: row._count.rating,
    });
  }

  // ---- Apply minRating filter in JS (since Prisma groupBy can't easily do HAVING here) ----
  let filtered = prompts;
  if (minRating !== undefined && !Number.isNaN(minRating)) {
    filtered = filtered.filter((p) => {
      const stats = ratingStatsByPromptId.get(p.id);
      if (!stats || stats.avg === null) return false;
      return stats.avg >= minRating;
    });
  }

  // ---- Apply sort on sales/rating in JS when requested ----
  let sorted = filtered.slice();

  if (sort === "sales") {
    sorted.sort((a, b) => {
      const salesA = salesByPromptId.get(a.id) ?? 0;
      const salesB = salesByPromptId.get(b.id) ?? 0;
      return salesB - salesA;
    });
  } else if (sort === "rating") {
    sorted.sort((a, b) => {
      const ra = ratingStatsByPromptId.get(a.id);
      const rb = ratingStatsByPromptId.get(b.id);
      const aAvg = ra?.avg ?? 0;
      const bAvg = rb?.avg ?? 0;
      if (bAvg === aAvg) {
        const aCount = ra?.count ?? 0;
        const bCount = rb?.count ?? 0;
        return bCount - aCount;
      }
      return bAvg - aAvg;
    });
  }
  // For "latest" and price_asc/price_desc, DB orderBy already took care of it.

  const promptsToShow = sorted;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header + quick links */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Marketplace</h1>
            <p className="text-sm text-muted-foreground">
              Browse prompts created by the community.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/purchases">My purchases</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/creator/prompts">Creator dashboard</Link>
            </Button>
          </div>
        </div>

        {/* Search + filters */}
        <section className="rounded-xl border bg-card shadow-sm">
          <form className="flex flex-col gap-4 p-4 md:flex-row md:flex-wrap md:items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label
                htmlFor="q"
                className="text-xs font-medium text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="q"
                name="q"
                placeholder="Search by title or description..."
                defaultValue={q}
                className="w-full"
              />
            </div>

            <div className="w-[160px] space-y-1">
              <label
                htmlFor="priceFilter"
                className="text-xs font-medium text-muted-foreground"
              >
                Price
              </label>
              <select
                id="priceFilter"
                name="priceFilter"
                defaultValue={priceFilter}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div className="w-[140px] space-y-1">
              <label
                htmlFor="minPrice"
                className="text-xs font-medium text-muted-foreground"
              >
                Min price
              </label>
              <Input
                id="minPrice"
                name="minPrice"
                type="number"
                step="0.5"
                min="0"
                defaultValue={minPriceRaw}
              />
            </div>

            <div className="w-[140px] space-y-1">
              <label
                htmlFor="maxPrice"
                className="text-xs font-medium text-muted-foreground"
              >
                Max price
              </label>
              <Input
                id="maxPrice"
                name="maxPrice"
                type="number"
                step="0.5"
                min="0"
                defaultValue={maxPriceRaw}
              />
            </div>

            <div className="w-[140px] space-y-1">
              <label
                htmlFor="minRating"
                className="text-xs font-medium text-muted-foreground"
              >
                Min rating
              </label>
              <Input
                id="minRating"
                name="minRating"
                type="number"
                min="1"
                max="5"
                step="0.5"
                defaultValue={minRatingRaw}
              />
            </div>

            <div className="w-[160px] space-y-1">
              <label
                htmlFor="tag"
                className="text-xs font-medium text-muted-foreground"
              >
                Tag
              </label>
              <Input
                id="tag"
                name="tag"
                placeholder="e.g. marketing"
                defaultValue={tag}
              />
            </div>

            <div className="w-[170px] space-y-1">
              <label
                htmlFor="sort"
                className="text-xs font-medium text-muted-foreground"
              >
                Sort by
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="latest">Latest</option>
                <option value="sales">Most sales</option>
                <option value="rating">Highest rated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </div>

            <div className="ml-auto flex gap-2">
              <Button type="submit" size="sm">
                Apply
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <Link href="/prompts">Reset</Link>
              </Button>
            </div>
          </form>
        </section>

        {/* Results */}
        {promptsToShow.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 p-8 text-center text-muted-foreground">
            <p>No prompts found. Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {promptsToShow.map((prompt) => {
              const promptKey = prompt.id;
              const salesCount = salesByPromptId.get(promptKey) ?? 0;
              const isOwned = ownedPromptIds.has(promptKey);
              const priceNumber = prompt.price ? Number(prompt.price) : 0;
              const priceDisplay =
                priceNumber > 0 ? `$${priceNumber.toFixed(2)}` : "Free";

              const ratingStats = ratingStatsByPromptId.get(promptKey);
              const avg = ratingStats?.avg ?? null;
              const ratingCount = ratingStats?.count ?? 0;
              const description =
                prompt.description && prompt.description.length > 160
                  ? `${prompt.description.slice(0, 160)}...`
                  : prompt.description;

              return (
                <div
                  key={prompt.id}
                  className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold leading-snug">{prompt.title}</h2>
                    {Array.isArray(prompt.tags) && prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {prompt.tags.slice(0, 4).map((tagValue: string) => (
                          <span
                            key={tagValue}
                            className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            {tagValue}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {description || "No description provided."}
                    </p>
                  </div>

                  <div className="mt-auto space-y-3 pt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{priceDisplay}</span>
                      {salesCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {salesCount} sale{salesCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      {avg !== null && ratingCount > 0 ? (
                        <span>
                          {avg.toFixed(1)} ★ · {ratingCount} rating
                          {ratingCount === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span>No ratings yet</span>
                      )}
                      {isOwned && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          Owned
                        </span>
                      )}
                    </div>
                    <div className="pt-1">
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={`/prompt/${prompt.id}`}>View details</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
