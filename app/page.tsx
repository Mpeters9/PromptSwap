// app/page.tsx
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PromptPreviewImage } from "@/components/PromptPreviewImage";

export const dynamic = "force-dynamic";

type PromptWithRelations = Awaited<ReturnType<typeof prisma.prompt.findMany>>[number];

export default async function HomePage() {
  const currentUser = await getCurrentUser();

  let promptCount = 0;
  let purchasesCount = 0;
  let creatorGroups: { userId: string | null; _count: { userId: number } }[] = [];
  let prompts: PromptWithRelations[] = [];

  try {
    const [promptCountResult, purchasesCountResult, creatorGroupsResult, promptsResult] =
      await Promise.all([
        prisma.prompt.count({
          where: { isPublic: true },
        }),
        prisma.purchase.count(),
        prisma.prompt.groupBy({
          by: ["userId"],
          _count: { userId: true },
          where: { isPublic: true },
        }),
        prisma.prompt.findMany({
          where: { isPublic: true },
          orderBy: { createdAt: "desc" },
          take: 12,
          include: {
            user: true,
          },
        }),
      ]);

    promptCount = promptCountResult;
    purchasesCount = purchasesCountResult;
    creatorGroups = creatorGroupsResult;
    prompts = promptsResult;
  } catch (error) {
    console.error("[home] Failed to load primary marketplace data", error);
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
    console.error("[home] Failed to load purchase/rating aggregates", error);
  }

  const creatorCount = creatorGroups.length;

  const salesByPromptId: Map<number, number> = new Map();
  for (const row of purchaseGroups) {
    salesByPromptId.set(row.promptId, row._count.promptId);
  }

  const ratingStatsByPromptId: Map<number, { avg: number | null; count: number }> = new Map();
  for (const row of ratingGroups) {
    if (row.promptId === null) continue;
    ratingStatsByPromptId.set(row.promptId, {
      avg: row._avg.rating ?? null,
      count: row._count.rating,
    });
  }

  // Build a "featured" list by scoring prompts based on sales + rating + recency
  const scoredPrompts = prompts.map((p) => {
    const sales = salesByPromptId.get(p.id) ?? 0;
    const stats = ratingStatsByPromptId.get(p.id);
    const avgRating = stats?.avg ?? 0;
    const ratingCount = stats?.count ?? 0;

    // Very simple heuristic score:
    //   sales weight + rating weight + mild recency boost
    const salesScore = sales * 3;
    const ratingScore = avgRating * Math.log10(ratingCount + 1);
    const recencyScore =
      (Date.now() - (p.createdAt?.getTime?.() ?? new Date().getTime())) /
      (1000 * 60 * 60 * 24 * 30); // months since created

    const recencyWeight = recencyScore > 0 ? Math.max(0, 3 - recencyScore) : 3;

    const score = salesScore + ratingScore + recencyWeight;

    return {
      ...p,
      sales,
      avgRating,
      ratingCount,
      score,
    };
  });

  const manuallyFeatured = scoredPrompts.filter((p) => p.isFeatured);
  const autoCandidates = scoredPrompts.filter((p) => !p.isFeatured);

  autoCandidates.sort((a, b) => b.score - a.score);

  // Take all manually featured first, then fill slots up to 6 with best auto candidates
  const combined = [...manuallyFeatured, ...autoCandidates];
  const featuredPrompts = combined.slice(0, 6);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      {/* Hero */}
      <section className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            The marketplace for high-converting AI prompts.
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            PromptSwap lets creators sell battle-tested prompts, and lets buyers
            instantly discover, purchase, and test them in a built-in chat
            playground.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="sm">
              <Link href="/prompts">Browse prompts</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={currentUser ? "/creator/prompts" : "/signin"}>
                Become a creator
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              No paid OpenAI key required in test mode.
            </span>
          </div>
        </div>

        <div className="mt-4 w-full max-w-sm md:mt-0">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                See how a prompt sells
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time stats for creators: revenue, sales, views, conversion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Launch funnel wizard</span>
                <span className="font-medium">$1,243.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly sales</span>
                <span className="font-medium">82</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">View → purchase</span>
                <span className="font-medium">7.4%</span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Analytics are available out of the box for every creator.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Public prompts
            </CardTitle>
            <CardDescription className="text-2xl font-semibold text-foreground">
              {promptCount}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active creators
            </CardTitle>
            <CardDescription className="text-2xl font-semibold text-foreground">
              {creatorCount}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total purchases
            </CardTitle>
            <CardDescription className="text-2xl font-semibold text-foreground">
              {purchasesCount}
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      {/* Featured prompts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Featured prompts</h2>
            <p className="text-xs text-muted-foreground">
              Curated automatically from sales, ratings, and freshness.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/prompts">View marketplace</Link>
          </Button>
        </div>

        {featuredPrompts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">No prompts yet</CardTitle>
              <CardDescription className="text-xs">
                Once creators publish public prompts, they’ll be featured here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {featuredPrompts.map((p) => {
              const priceNumber = p.price ? Number(p.price) : 0;
              const priceDisplay =
                priceNumber > 0 ? `$${priceNumber.toFixed(2)}` : "Free";
              const sales = p.sales;
              const avg = p.avgRating;
              const ratingCount = p.ratingCount;

              return (
                <Link
                  key={p.id}
                  href={`/prompts/${p.id}`}
                  className="group"
                >
                  <Card className="flex h-full flex-col overflow-hidden border border-slate-200/70 transition-all duration-150 hover:-translate-y-1 hover:shadow-lg">
                    <PromptPreviewImage
                      src={p.previewImage}
                      alt={p.title ?? "Prompt preview"}
                    />
                    <CardHeader className="space-y-2">
                      <CardTitle className="line-clamp-2 text-sm">
                        {p.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-xs">
                        {p.description}
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
                        {Array.isArray(p.tags) &&
                          p.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="rounded-full"
                            >
                              #{tag}
                            </Badge>
                          ))}
                        {p.isFeatured && (
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-amber-100 text-amber-800 border-amber-200"
                          >
                            Featured
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {sales} sale{sales === 1 ? "" : "s"}
                        </span>
                        {avg && ratingCount > 0 ? (
                          <span>
                            {avg.toFixed(1)} / 5 · {ratingCount} rating
                            {ratingCount === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span>No ratings yet</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Split section: buyers vs creators */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              For buyers
            </CardTitle>
            <CardDescription className="text-xs">
              Find prompts that actually drive results, not just demos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <ul className="list-inside list-disc space-y-1">
              <li>Browse by price, tags, rating, and sales.</li>
              <li>Pay once, unlock forever in your library.</li>
              <li>Test any purchased prompt in the built-in chat playground.</li>
            </ul>
            <Button asChild size="sm" className="mt-2">
              <Link href="/prompts">Start browsing</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              For creators
            </CardTitle>
            <CardDescription className="text-xs">
              Turn your best prompts into a real revenue stream in a weekend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <ul className="list-inside list-disc space-y-1">
              <li>Publish, price, and update prompts with version history.</li>
              <li>Track revenue, views, sales, and conversion per prompt.</li>
              <li>See &quot;also bought&quot; insights and ratings from buyers.</li>
            </ul>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="mt-2"
            >
              <Link href={currentUser ? "/creator/prompts" : "/signin"}>
                Open creator dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
