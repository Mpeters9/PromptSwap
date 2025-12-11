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
    redirect("/signin");
  }

  const prompts = await prisma.prompt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  let salesGroups: { promptId: number; _count: { promptId: number } }[] = [];
  let viewGroups: { promptId: number; _count: { promptId: number } }[] = [];

  try {
    [salesGroups, viewGroups] = await Promise.all([
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
    console.error("[creator/prompts] Failed to load creator aggregates", error);
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

  const topPrompt = topPromptId
    ? prompts.find((p) => p.id === topPromptId)
    : null;

  const hasAnyPrompts = prompts.length > 0;
  const hasPreviewImage = prompts.some((p) => !!(p as any).previewImage);
  const hasPublicPrompt = prompts.some((p) => (p as any).isPublic);
  const hasAnyViews = Array.from(viewsCountByPromptId.values()).some(
    (count) => count > 0,
  );
  const hasAnySales = totalSales > 0;

  const onboardingSteps = [
    {
      id: "create-prompt",
      label: "Create your first prompt",
      done: hasAnyPrompts,
    },
    {
      id: "add-preview",
      label: "Add a preview image to a prompt",
      done: hasPreviewImage,
    },
    {
      id: "publish-prompt",
      label: "Publish a prompt to the marketplace",
      done: hasPublicPrompt,
    },
    {
      id: "get-views",
      label: "Get your first view",
      done: hasAnyViews,
    },
    {
      id: "make-sale",
      label: "Make your first sale",
      done: hasAnySales,
    },
  ];

  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const totalSteps = onboardingSteps.length;
  const progressPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Prompts</h1>
          <p className="text-sm text-muted-foreground">
            Manage the prompts you’ve created and see how they’re performing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/creator/analytics">Analytics</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/creator/prompts/new">New Prompt</Link>
          </Button>
        </div>
      </div>

      {/* Onboarding checklist */}
      {completedSteps < totalSteps && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Get set up as a creator
            </CardTitle>
            <CardDescription className="text-xs">
              You&apos;re {completedSteps} of {totalSteps} steps complete. Finish these to
              get the most out of PromptSwap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <ul className="mt-2 space-y-1.5">
              {onboardingSteps.map((step) => (
                <li key={step.id} className="flex items-center gap-2">
                  <span
                    className={
                      "flex h-4 w-4 items-center justify-center rounded-full border text-[10px] " +
                      (step.done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 text-slate-400")
                    }
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <span
                    className={
                      "text-[11px] " +
                      (step.done ? "text-slate-500 line-through" : "text-slate-800")
                    }
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
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
              Top prompt
            </CardTitle>
            <CardDescription className="text-sm font-medium text-foreground line-clamp-2">
              {topPrompt ? topPrompt.title : "No sales yet"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {prompts.length === 0 ? (
        <Card>
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
        <div className="grid gap-4 md:grid-cols-2">
          {prompts.map((prompt) => {
            const promptKey = prompt.id;
            const salesCount = salesCountByPromptId.get(promptKey) ?? 0;
            const viewsCount = viewsCountByPromptId.get(promptKey) ?? 0;
            const priceDisplay =
              prompt.price && Number(prompt.price) > 0
                ? `$${Number(prompt.price).toFixed(2)}`
                : "Free";
            const conversion =
              viewsCount > 0 ? (salesCount / viewsCount) * 100 : 0;
            const isFeatured = (prompt as any).isFeatured;

            return (
              <Card key={prompt.id} className="flex flex-col">
                <CardHeader className="space-y-1">
                  <CardTitle className="line-clamp-2 text-base">
                    {prompt.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">
                    {prompt.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex flex-col gap-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{priceDisplay}</Badge>
                      {Array.isArray(prompt.tags) &&
                        prompt.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      {isFeatured && (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800 border-amber-200"
                        >
                          Featured
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      <span>
                        {salesCount} sale{salesCount === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <span>
                        {viewsCount} view{viewsCount === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <span>{conversion.toFixed(1)}% conversion</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button asChild size="xs" variant="outline">
                      <Link href={`/prompts/${prompt.id}`}>View</Link>
                    </Button>
                    <Button asChild size="xs" variant="ghost">
                      <Link href={`/creator/prompts/${prompt.id}/edit`}>Edit</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
