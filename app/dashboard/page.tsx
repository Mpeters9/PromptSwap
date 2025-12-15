import Link from "next/link";

import { createChatSession, listChatSessions } from "./actions";
import { getCurrentUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const sessions = await listChatSessions(userId);

  async function createSessionAction() {
    "use server";

    const innerUser = await getCurrentUser();
    const innerUserId = innerUser?.id ?? null;

    await createChatSession({ userId: innerUserId });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card px-6 py-6 text-left shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</p>
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your purchases, listings, and activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/prompts"
            className="rounded-full border border-border/80 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Browse marketplace
          </Link>
          <Link
            href="/creator/prompts/new"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Create prompt
          </Link>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick actions</p>
            <h2 className="text-lg font-semibold text-foreground">Your library</h2>
          </div>
          <Link
            href="/dashboard/purchases"
            className="text-sm font-semibold text-foreground transition hover:text-foreground/70"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/purchases"
            className="rounded-xl border bg-card p-5 text-sm shadow-sm transition hover:border-foreground/40"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Library</p>
            <p className="mt-3 text-base font-semibold text-foreground">My purchases</p>
            <p className="mt-2 text-xs text-muted-foreground">Review your prompt history</p>
          </Link>
          <Link
            href="/creator/prompts"
            className="rounded-xl border bg-card p-5 text-sm shadow-sm transition hover:border-foreground/40"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Listings</p>
            <p className="mt-3 text-base font-semibold text-foreground">My prompts</p>
            <p className="mt-2 text-xs text-muted-foreground">Manage what you&apos;re selling</p>
          </Link>
          <Link
            href="/chat"
            className="rounded-xl border bg-card p-5 text-sm shadow-sm transition hover:border-foreground/40"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick actions</p>
            <p className="mt-3 text-base font-semibold text-foreground">Chat playground</p>
            <p className="mt-2 text-xs text-muted-foreground">Continue conversations</p>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent purchases</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Your latest orders</h2>
            </div>
            <Link
              href="/purchases"
              className="text-sm font-semibold text-foreground transition hover:text-foreground/70"
            >
              View purchases
            </Link>
          </div>
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <p>No purchases are shown here yet.</p>
            <p>Browse the marketplace to find prompts that inspire you.</p>
            <Link
              href="/prompts"
              className="inline-flex items-center rounded-full border border-border/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground transition hover:bg-muted"
            >
              Browse marketplace
            </Link>
          </div>
        </article>

        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Chat sessions</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Chat playground</h2>
            </div>
            <form action={createSessionAction}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
              >
                New chat
              </button>
            </form>
          </div>

          {sessions.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
              <p className="font-normal">
                You don&apos;t have any chat sessions yet. Start a conversation to keep experimenting with prompts.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/chat/${session.id}`}
                  className="rounded-xl border border-border/60 bg-card p-4 transition hover:shadow-sm"
                >
                  <h3 className="font-medium truncate text-foreground">
                    {session.title || "Untitled chat"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(session.createdAt ?? Date.now()).toLocaleString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
