// app/prompts/page.tsx
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase-server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PromptPreviewImage } from "@/components/PromptPreviewImage";

type PromptWithRelations = Awaited<ReturnType<typeof prisma.prompt.findMany>>[number];

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
  searchParams: SearchParams;
}) {
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id ?? null;

  // ---- Read search params (normalize to strings) ----
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const priceFilter =
    typeof searchParams.priceFilter === "string"
      ? searchParams.priceFilter
      : "all";
  const minPriceRaw =
    typeof searchParams.minPrice === "string" ? searchParams.minPrice : "";
  const maxPriceRaw =
    typeof searchParams.maxPrice === "string" ? searchParams.maxPrice : "";
  const minRatingRaw =
    typeof searchParams.minRating === "string" ? searchParams.minRating : "";
  const tag = typeof searchParams.tag === "string" ? searchParams.tag.trim() : "";
  const sort =
    typeof searchParams.sort === "string" ? searchParams.sort : "latest";

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

  let prompts: PromptWithRelations[] = [];
  let userPurchases: { promptId: number }[] = [];

  try {
    [prompts, userPurchases] = await Promise.all([
      prisma.prompt.findMany({
        where,
        orderBy,
        include: {
          user: true,
        },
      }),
      currentUser
        ? prisma.purchase.findMany({
            where: { buyerId: currentUser.id },
            select: { promptId: true },
          })
        : Promise.resolve([] as { promptId: number }[]),
    ]);
  } catch (error) {
    console.error("[prompts] Failed to load prompts/user purchases", error);
    // defaults remain
  }

  let purchaseGroups: { promptId: number; _count: { promptId: number } }[] = [];
  let ratingGroups: {
    promptId: number | null;
    _avg: { rating: number | null };
    _count: { rating: number };
  }[] = [];

  try {
    [purchaseGroups, ratingGroups] = await Promise.all([
      prisma.purchase.groupBy({
        by: ["promptId"],
        _count: { promptId: true },
      }),
      prisma.promptRating.groupBy({
        by: ["promptId"],
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
  } catch (error) {
    console.error("[prompts] Failed to load aggregates", error);
    // leave arrays empty so the UI still works with zero sales / no ratings
  }

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
    <main className="mx-auto flex w/full max-w-5xl flex-col gap-6 px-4 py-8">
      {/* Header + quick links */}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Prompt marketplace
          </h1>
          <p className="text-sm text-muted-foreground">
            Discover, buy, and test prompts from top creators.
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
      <section className="rounded-lg border bg-card p-4">
        <form className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="flex-1 min-w-[180px] space-y-1">
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
            />
          </div>

          <div className="w-[150px] space-y-1">
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
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="w-[130px] space-y-1">
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

          <div className="w-[130px] space-y-1">
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

          <div className="w-[130px] space-y-1">
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

          <div className="w-[150px] space-y-1">
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

          <div className="w/[160px] space-y-1">
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
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="latest">Latest</option>
              <option value="sales">Most sales</option>
              <option value="rating">Highest rated</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>

          <div className="ml-auto flex gap-2 pt-1">
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
        <Card>
          <CardHeader>
            <CardTitle>No prompts match your filters</CardTitle>
            <CardDescription>
              Try clearing some filters or searching for something else.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

            return (
              <Link
                key={prompt.id}
                href={`/prompts/${prompt.id}`}
                className="group"
              >
                <Card className="flex h-full flex-col transition-all duration-150 hover:-translate-y-1 hover:shadow-lg">
                  <PromptPreviewImage
                    src={prompt.previewImage}
                    alt={prompt.title}
                  />
                  <CardHeader className="space-y-2">
                    <CardTitle className="line-clamp-2 text-base">
                      {prompt.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {prompt.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex flex-col gap-2 pb-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full bg-white/70 backdrop-blur"
                      >
                        {priceDisplay}
                      </Badge>
                      {Array.isArray(prompt.tags) &&
                        prompt.tags.slice(0, 3).map((tagValue) => (
                          <Badge
                            key={tagValue}
                            variant="secondary"
                            className="rounded-full"
                          >
                            #{tagValue}
                          </Badge>
                        ))}
                      {salesCount > 0 && (
                        <Badge variant="secondary">
                          {salesCount} sale
                          {salesCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      {avg !== null && ratingCount > 0 ? (
                        <span>
                          {avg.toFixed(1)} / 5 · {ratingCount} rating
                          {ratingCount === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span>No ratings yet</span>
                      )}
                      {isOwned && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Owned
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
