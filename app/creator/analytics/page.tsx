// app/creator/analytics/page.tsx
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RevenueChart } from "@/components/creator/RevenueChart";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type RevenueByPrompt = {
  promptId: number;
  title: string;
  sales: number;
  revenue: number;
};

type RevenueByMonth = {
  monthLabel: string; // e.g. 2025-01
  revenue: number;
};

export const dynamic = "force-dynamic";

export default async function CreatorAnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  const [purchases, views, prompts] = await Promise.all([
    prisma.purchase.findMany({
      where: {
        sellerId: user.id,
      },
      include: {
        prompt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.promptView.findMany({
      where: {
        prompt: {
          userId: user.id,
        },
      },
      select: {
        promptId: true,
      },
    }),
    prisma.prompt.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        title: true,
        price: true,
      },
    }),
  ]);

  const totalSales = purchases.length;

  let totalRevenue = 0;
  const revenueByPrompt = new Map<number, RevenueByPrompt>();
  const revenueByMonth = new Map<string, number>();
  const viewsByPrompt = new Map<number, number>();

  // Aggregate views per prompt
  for (const v of views) {
    const promptKey = v.promptId;
    const prev = viewsByPrompt.get(promptKey) ?? 0;
    viewsByPrompt.set(promptKey, prev + 1);
  }

  // Prompt meta map
  const promptMeta = new Map<number, { title: string; price: number }>();
  for (const p of prompts) {
    const promptKey = p.id;
    promptMeta.set(promptKey, {
      title: p.title || "Untitled prompt",
      price: p.price != null ? Number(p.price) : 0,
    });
  }

  for (const p of purchases) {
    const prompt = p.prompt;
    if (!prompt) continue;

    const promptKey = prompt.id;
    const price =
      (p as any).price != null
        ? Number((p as any).price)
        : prompt.price != null
        ? Number(prompt.price)
        : 0;

    totalRevenue += price;

    // Per-prompt stats
    const existing = revenueByPrompt.get(promptKey) ?? {
      promptId: promptKey,
      title: prompt.title || "Untitled prompt",
      sales: 0,
      revenue: 0,
    };

    existing.sales += 1;
    existing.revenue += price;
    revenueByPrompt.set(promptKey, existing);

    // Per-month stats
    const createdAt = p.createdAt ?? new Date();
    const year = createdAt.getFullYear();
    const month = createdAt.getMonth() + 1;
    const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

    const prev = revenueByMonth.get(monthLabel) ?? 0;
    revenueByMonth.set(monthLabel, prev + price);
  }

  const totalViews = Array.from(viewsByPrompt.values()).reduce(
    (sum, n) => sum + n,
    0,
  );

  const overallConversion =
    totalViews > 0 ? (totalSales / totalViews) * 100 : 0;

  const revenueByPromptSorted = Array.from(revenueByPrompt.values()).sort(
    (a, b) => b.revenue - a.revenue,
  );

  const monthlyRevenue: RevenueByMonth[] = Array.from(revenueByMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([monthLabel, revenue]) => ({
      monthLabel,
      revenue,
    }));

  const topPrompt = revenueByPromptSorted[0] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Creator analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            See how your prompts are performing over time.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/creator/prompts">My prompts</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/creator/prompts/new">New prompt</Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total revenue
            </CardTitle>
            <p className="text-2xl font-semibold text-foreground">
              ${totalRevenue.toFixed(2)}
            </p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-1 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total sales
            </CardTitle>
            <p className="text-2xl font-semibold text-foreground">
              {totalSales}
            </p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-1 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total views
            </CardTitle>
            <p className="text-2xl font-semibold text-foreground">
              {totalViews}
            </p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-1 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Overall conversion
            </CardTitle>
            <p className="text-2xl font-semibold text-foreground">
              {overallConversion.toFixed(1)}%
            </p>
          </CardHeader>
        </Card>
      </section>

      {/* Revenue over time chart */}
      <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Revenue over time
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Aggregated by month. Use this to see momentum and growth.
            </p>
          </CardHeader>
          <CardContent>
            <RevenueChart data={monthlyRevenue} />
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Snapshot
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              High-level view of your earnings.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Average revenue / sale</span>
              <span className="font-medium">
                {totalSales > 0
                  ? `$${(totalRevenue / totalSales).toFixed(2)}`
                  : "$0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Prompts with sales</span>
              <span className="font-medium">{revenueByPrompt.size}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last sale</span>
              <span className="font-medium">
                {purchases.length > 0
                  ? purchases[purchases.length - 1].createdAt?.toLocaleDateString() ??
                    ""
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Top prompts table */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Top prompts by revenue
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Your highest-earning prompts, ranked by total revenue.
            </p>
          </CardHeader>
          <CardContent>
            {revenueByPromptSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Once you start making sales, you&apos;ll see your top prompts here.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {revenueByPromptSorted.map((row) => {
                  const viewsForPrompt = viewsByPrompt.get(row.promptId) ?? 0;
                  const conv =
                    viewsForPrompt > 0
                      ? (row.sales / viewsForPrompt) * 100
                      : 0;

                  return (
                    <div
                      key={row.promptId}
                      className="flex items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <Link
                          href={`/prompts/${row.promptId}`}
                          className="font-medium hover:underline"
                        >
                          {row.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {row.sales} sale
                            {row.sales === 1 ? "" : "s"}
                          </span>
                          <span>·</span>
                          <span>${row.revenue.toFixed(2)} total</span>
                          <span>·</span>
                          <span>
                            {viewsForPrompt} view{viewsForPrompt === 1 ? "" : "s"}
                          </span>
                          <span>·</span>
                          <span>{conv.toFixed(1)}% conversion</span>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        ${row.sales > 0
                          ? (row.revenue / row.sales).toFixed(2)
                          : "0.00"}{" "}
                        / sale
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
