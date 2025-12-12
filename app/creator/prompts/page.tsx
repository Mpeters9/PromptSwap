// app/creator/prompts/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentUser } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function CreatorPromptsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  let prompts: any[] = [];
  let salesGroups: any[] = [];
  let viewGroups: any[] = [];

  try {
    [prompts, salesGroups, viewGroups] = await Promise.all([
      prisma.prompt.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchase.groupBy({
        by: ["promptId"],
        _count: { promptId: true },
        where: { sellerId: user.id },
      }),
      prisma.promptView.groupBy({
        by: ["promptId"],
        _count: { promptId: true },
        where: {
          prompt: {
            userId: user.id,
          },
        },
      }),
    ]);
  } catch (error) {
    console.error("[creator/prompts] Failed to load creator prompts/analytics", error);
  }

  const salesCountByPromptId = new Map<number, number>();
  const viewsCountByPromptId = new Map<number, number>();
  let totalSales = 0;
  let topPromptId: number | null = null;
  let topPromptSales = 0;

  for (const row of salesGroups) {
    const count = row._count.promptId;
    salesCountByPromptId.set(row.promptId, count);
    totalSales += count;
    if (count > topPromptSales) {
      topPromptSales = count;
      topPromptId = row.promptId;
    }
  }

  for (const row of viewGroups) {
    viewsCountByPromptId.set(row.promptId, row._count.promptId);
  }

  const totalViews = Array.from(viewsCountByPromptId.values()).reduce((sum, n) => sum + n, 0);

  const topPrompt = topPromptId ? prompts.find((p) => p.id === topPromptId) : null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Your prompts</h1>
            <p className="text-sm text-muted-foreground">
              Manage your listings and see how they&apos;re performing.
            </p>
          </div>
          <Button asChild>
            <Link href="/creator/prompts/new">Create new prompt</Link>
          </Button>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="space-y-1 py-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total prompts
              </CardTitle>
              <CardDescription className="text-2xl font-semibold text-foreground">
                {prompts.length}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="space-y-1 py-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total sales
              </CardTitle>
              <CardDescription className="text-2xl font-semibold text-foreground">
                {totalSales}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="space-y-1 py-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total views
              </CardTitle>
              <CardDescription className="text-2xl font-semibold text-foreground">
                {totalViews}
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        {prompts.length === 0 ? (
          <Card className="border border-dashed">
            <CardHeader>
              <CardTitle>No prompts yet</CardTitle>
              <CardDescription>
                Create your first prompt and start selling it on the marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/creator/prompts/new">Create a prompt</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Price</th>
                  <th className="px-4 py-2 text-left">Sales</th>
                  <th className="px-4 py-2 text-left">Views</th>
                  <th className="px-4 py-2 text-left">Created</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prompts.map((prompt) => {
                  const promptKey = prompt.id;
                  const salesCount = salesCountByPromptId.get(promptKey) ?? 0;
                  const viewsCount = viewsCountByPromptId.get(promptKey) ?? 0;
                  const priceDisplay =
                    prompt.price && Number(prompt.price) > 0
                      ? `$${Number(prompt.price).toFixed(2)}`
                      : "Free";
                  const isFeatured = (prompt as any).isFeatured;

                  return (
                    <tr key={prompt.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-2">{prompt.title}</span>
                          {isFeatured && (
                            <Badge
                              variant="secondary"
                              className="bg-amber-100 text-amber-800 border-amber-200"
                            >
                              Featured
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {prompt.description}
                        </p>
                      </td>
                      <td className="px-4 py-3">{priceDisplay}</td>
                      <td className="px-4 py-3">{salesCount}</td>
                      <td className="px-4 py-3">{viewsCount}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {prompt.createdAt?.toLocaleDateString?.() ?? ""}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link href={`/prompt/${prompt.id}`} className="text-sm font-semibold underline">
                          View
                        </Link>
                        <Link
                          href={`/creator/prompts/${prompt.id}/edit`}
                          className="text-sm font-semibold underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {topPrompt && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Top performer</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {topPrompt.title} - {salesCountByPromptId.get(topPrompt.id) ?? 0} sales
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </main>
  );
}

