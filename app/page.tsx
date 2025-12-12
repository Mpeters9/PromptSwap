import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentUser = await getCurrentUser();

  let promptCount = 0;
  let featuredPrompts: any[] = [];

  try {
    const promptCountResult = await prisma.prompt.count({
      where: { isPublic: true },
    });

    promptCount = promptCountResult;

    featuredPrompts = await prisma.prompt.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        description: true,
        previewImage: true,
        price: true,
        tags: true,
        createdAt: true,
        isFeatured: true,
      },
    });
  } catch (error) {
    console.error("[home] Failed to load basic prompt data", error);
  }

  const primaryActionHref = currentUser ? "/dashboard" : "/auth/login";
  const primaryActionLabel = currentUser ? "Go to dashboard" : "Sign in to start";

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 sm:py-20">
        <section className="rounded-3xl border border-border/60 bg-card p-10 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">PromptSwap</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            PromptSwap — prompts that actually work
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            Buy, sell, and unlock AI workflow recipes that ship fast. Instant access after purchase,
            one-time pricing, and creator payouts wired through Stripe.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={primaryActionHref}
              className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg transition hover:opacity-90"
            >
              {primaryActionLabel}
            </Link>
            <Link
              href="/prompts"
              className="inline-flex items-center justify-center rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Browse marketplace
            </Link>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Instant access • One-time purchase • Creator payouts via Stripe
          </p>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Marketplace facts</p>
              <h2 className="text-2xl font-semibold text-foreground">Built for real workflows</h2>
            </div>
            <Link
              href="/prompts"
              className="text-sm font-semibold text-foreground transition hover:text-foreground/80"
            >
              Browse prompts
            </Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Prompts</p>
              <p className="text-3xl font-bold text-foreground">{promptCount ?? 0}</p>
              <p className="text-sm text-muted-foreground">Production-ready prompts verified by PromptSwap.</p>
            </article>
            <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Creator payouts</p>
              <p className="text-3xl font-bold text-foreground">Stripe-ready</p>
              <p className="text-sm text-muted-foreground">
                Creators land instant deposits, so they keep building.
              </p>
            </article>
            <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Support</p>
              <p className="text-3xl font-bold text-foreground">Human-first</p>
              <p className="text-sm text-muted-foreground">
                We're in your corner if prompts need support or tuning.
              </p>
            </article>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Featured prompts</h2>
              <p className="text-sm text-muted-foreground">
                Handpicked creations to accelerate your next launch.
              </p>
            </div>
            <Link
              href="/prompts"
              className="text-sm font-semibold text-foreground transition hover:text-foreground/80"
            >
              Browse all prompts
            </Link>
          </div>

          {featuredPrompts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              <p>No featured prompts yet. Explore the marketplace to discover new favorites.</p>
              <Link
                href="/prompts"
                className="mt-3 inline-flex items-center justify-center rounded-full border border-border/70 px-4 py-2 text-sm font-semibold text-foreground"
              >
                Browse marketplace
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredPrompts.map((p) => {
                const priceNumber = p.price ? Number(p.price) : 0;
                const priceDisplay = priceNumber > 0 ? `$${priceNumber.toFixed(2)}` : "Free";
                const description =
                  p.description && p.description.length > 120
                    ? `${p.description.slice(0, 120)}...`
                    : p.description ?? "No description provided.";

                return (
                  <article
                    key={p.id}
                    className="flex h-full flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground line-clamp-2">{p.title}</h3>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {(p.tags ?? []).slice(0, 4).map((tag: string) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between text-sm text-muted-foreground">
                      <span className="text-base font-semibold text-foreground">{priceDisplay}</span>
                      <Link
                        href={`/prompt/${p.id}`}
                        className="text-sm font-semibold text-primary transition hover:underline"
                      >
                        View prompt
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
