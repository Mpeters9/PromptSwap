import { notFound, redirect } from 'next/navigation';

import Link from 'next/link';
import BuyButton from '@/components/BuyButton';
import CopyButton from '@/components/CopyButton';
import { PromptPreviewImage } from '@/components/PromptPreviewImage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase-server';
import ClientSections, { ActionPanel } from './ClientSections';

export type Prompt = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  prompt_text: string;
  tags: string[] | null;
  price: number | null;
  preview_image: string | null;
  is_public: boolean | null;
  created_at: string;
};

export type Rating = {
  user_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

export type PromptVersion = {
  id: string;
  prompt_id: string;
  user_id: string | null;
  content: string | null;
  notes: string | null;
  created_at: string;
};

type AlsoBoughtPrompt = {
  id: string;
  title: string;
  previewImage: string | null;
  price: number | null;
  tags: string[] | null;
  alsoBoughtCount: number;
};

export async function startTestSession(formData: FormData) {
  'use server';

  const promptId = (formData.get('prompt_id') ?? '').toString().trim();
  if (!promptId) {
    throw new Error('Missing prompt_id');
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  // Fetch the prompt text from Prisma
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      title: true,
      promptText: true,
      price: true,
    },
  });

  if (!prompt) {
    redirect('/prompts');
  }

  // If this is a paid prompt, enforce ownership on the server as well.
  const priceNumber = prompt.price ? Number(prompt.price) : 0;
  if (priceNumber > 0) {
    const hasPurchase = await prisma.purchase.findFirst({
      where: {
        promptId: prompt.id,
        buyerId: user.id,
      },
      select: { id: true },
    });

    if (!hasPurchase) {
      // User tried to bypass the UI paywall; send them back.
      redirect(`/prompts/${prompt.id}`);
    }
  }

  // Create a chat session tied to this user
  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      title: `Test: ${prompt.title}`,
    },
  });

  // Seed the session with a system message that embeds this prompt
  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: 'system',
      content: [
        'You are helping the user test the following marketplace prompt.',
        '',
        'PROMPT:',
        prompt.promptText,
        '',
        'When the user sends inputs, apply the prompt faithfully and show representative outputs.',
      ].join('\n'),
    },
  });

  redirect(`/chat/${session.id}`);
}

export async function ratePrompt(formData: FormData) {
  'use server';

  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  const promptId = (formData.get('prompt_id') ?? '').toString().trim();
  const ratingRaw = (formData.get('rating') ?? '').toString().trim();
  const comment = (formData.get('comment') ?? '').toString().trim();

  if (!promptId || !ratingRaw) {
    throw new Error('Missing prompt or rating.');
  }

  const ratingValue = parseInt(ratingRaw, 10);
  if (Number.isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }

  // Check that the prompt exists
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      userId: true,
      price: true,
    },
  });

  if (!prompt) {
    redirect('/prompts');
  }

  // If prompt is paid, require purchase OR creator ownership.
  const priceNumber = prompt.price ? Number(prompt.price) : 0;
  if (priceNumber > 0 && prompt.userId !== user.id) {
    const hasPurchase = await prisma.purchase.findFirst({
      where: {
        promptId: prompt.id,
        buyerId: user.id,
      },
      select: { id: true },
    });

    if (!hasPurchase) {
      // User isn’t allowed to rate this prompt
      redirect(`/prompts/${prompt.id}`);
    }
  }

  // Upsert rating: one per user per prompt.
  const existing = await prisma.promptRating.findFirst({
    where: {
      promptId,
      userId: user.id,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.promptRating.update({
      where: { id: existing.id },
      data: {
        rating: ratingValue,
        comment: comment || null,
      },
    });
  } else {
    await prisma.promptRating.create({
      data: {
        promptId,
        userId: user.id,
        rating: ratingValue,
        comment: comment || null,
      },
    });
  }

  // Simple redirect back to refresh the page and stats.
  redirect(`/prompts/${promptId}`);
}

async function getPrompt(id: string): Promise<Prompt | null> {
  const prompt = await prisma.prompt.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      promptText: true,
      tags: true,
      price: true,
      previewImage: true,
      isPublic: true,
      createdAt: true,
    },
  });

  if (!prompt) return null;

  return {
    id: prompt.id,
    user_id: prompt.userId,
    title: prompt.title,
    description: prompt.description,
    prompt_text: prompt.promptText ?? '',
    tags: (prompt.tags as string[] | null) ?? null,
    price: prompt.price ? Number(prompt.price) : null,
    preview_image: prompt.previewImage,
    is_public: prompt.isPublic,
    created_at: prompt.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

async function getRatings(promptId: string): Promise<Rating[]> {
  const rows = await prisma.promptRating.findMany({
    where: { promptId },
    orderBy: { createdAt: 'desc' },
    select: {
      userId: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    user_id: row.userId,
    rating: row.rating,
    comment: row.comment,
    created_at: row.createdAt?.toISOString() ?? null,
  }));
}

async function getSalesCount(promptId: string): Promise<number> {
  const count = await prisma.purchase.count({
    where: { promptId },
  });

  return count;
}

async function getVersions(promptId: string): Promise<PromptVersion[]> {
  const rows = await prisma.promptVersion.findMany({
    where: { promptId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      promptId: true,
      userId: true,
      content: true,
      notes: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    prompt_id: row.promptId!,
    user_id: row.userId,
    content: row.content,
    notes: row.notes,
    created_at: row.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

async function getAlsoBoughtPrompts(promptId: string): Promise<AlsoBoughtPrompt[]> {
  // 1) Find all buyers of this prompt
  const buyers = await prisma.purchase.findMany({
    where: { promptId },
    select: { buyerId: true },
  });

  const buyerIds = Array.from(
    new Set(
      buyers
        .map((b) => b.buyerId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (buyerIds.length === 0) {
    return [];
  }

  // 2) Group other purchases by promptId for those buyers
  const coPurchases = await prisma.purchase.groupBy({
    by: ['promptId'],
    where: {
      buyerId: { in: buyerIds },
      promptId: { not: promptId },
    },
    _count: { promptId: true },
  });

  if (coPurchases.length === 0) {
    return [];
  }

  const coPromptIds = coPurchases.map((p) => p.promptId);

  // 3) Load prompt data for those prompts
  const prompts = await prisma.prompt.findMany({
    where: {
      id: { in: coPromptIds },
      isPublic: true,
    },
    select: {
      id: true,
      title: true,
      previewImage: true,
      price: true,
      tags: true,
    },
  });

  const countByPromptId = new Map<string, number>();
  for (const row of coPurchases) {
    countByPromptId.set(row.promptId, row._count.promptId);
  }

  const results: AlsoBoughtPrompt[] = prompts.map((p) => ({
    id: p.id,
    title: p.title ?? 'Untitled prompt',
    previewImage: p.previewImage,
    price: p.price ? Number(p.price) : 0,
    tags: (p.tags as string[] | null) ?? null,
    alsoBoughtCount: countByPromptId.get(p.id) ?? 0,
  }));

  // 4) Sort by co-purchase count desc and take top 4
  results.sort((a, b) => b.alsoBoughtCount - a.alsoBoughtCount);

  return results.slice(0, 4);
}

async function getHasPurchased(promptId: string, buyerId: string | undefined): Promise<boolean> {
  if (!buyerId) return false;

  const purchase = await prisma.purchase.findFirst({
    where: {
      promptId,
      buyerId,
    },
    select: { id: true },
  });

  return !!purchase;
}

async function logPromptView(promptId: string, viewerId?: string) {
  // Fire-and-forget-ish: if this throws, we don't want to break the page.
  try {
    await prisma.promptView.create({
      data: {
        promptId,
        viewerId: viewerId ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to log prompt view", err);
  }
}

export default async function PromptDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [prompt, ratings, salesCount, versions, currentUser] = await Promise.all([
    getPrompt(id),
    getRatings(id),
    getSalesCount(id),
    getVersions(id),
    getCurrentUser(),
  ]);

  if (!prompt || prompt.is_public === false) {
    notFound();
  }

  const averageRating =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratings.length
      : null;

  // Normalize price to a number (0 if null)
  const price = prompt.price ?? 0;

  const currentUserId: string | undefined = currentUser?.id ?? undefined;
  const hasPurchased = await getHasPurchased(prompt.id, currentUserId);
  const currentUserRating = currentUserId
    ? ratings.find((r) => r.user_id === currentUserId) ?? null
    : null;
  const lastUpdatedAt =
    versions.length > 0 ? versions[0].created_at : prompt.created_at;
  const alsoBoughtPrompts = await getAlsoBoughtPrompts(prompt.id);
  // Log a view (best-effort, does not block rendering meaningfully)
  await logPromptView(prompt.id, currentUserId);

  const relatedPrompts = await prisma.prompt.findMany({
    where: {
      id: { not: id },
      isPublic: true,
      tags: {
        hasSome: prompt.tags ?? [],
      },
    },
    select: {
      id: true,
      title: true,
      previewImage: true,
      price: true,
      tags: true,
    },
    take: 4,
  });

  const promptTitle = prompt.title ?? 'Prompt';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const promptUrl = `${siteUrl}/prompts/${prompt.id}`;
  const shareText = `${promptTitle} - ${promptUrl}`;
  const tweetText = `Check out this AI prompt "${promptTitle}" on PromptSwap: ${promptUrl}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <main className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <PromptPreviewImage src={prompt.preview_image} alt={prompt.title} className="h-60" />
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">{prompt.title}</h1>
                  <p className="mt-1 text-sm text-slate-500">Added {new Date(prompt.created_at).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-500">
                    Last updated {new Date(lastUpdatedAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-slate-600">Created by {prompt.user_id ?? 'Unknown creator'}</p>
                  {prompt.user_id && (
                    <Link href={`/creator/${prompt.user_id}`} className="text-xs text-slate-500 hover:underline">
                      More prompts by this creator →
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {averageRating !== null && (
                    <div className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                      <span aria-hidden="true">★</span>
                      <span>{averageRating.toFixed(1)}</span>
                      <span className="text-xs text-amber-600">({ratings.length})</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                    {price > 0 ? `$${price.toFixed(2)}` : 'Free'}
                    {price > 0 && (
                      <BuyButton
                        promptId={prompt.id}
                        title={prompt.title}
                        price={price}
                        userId={currentUserId}
                        isCreator={currentUserId === prompt.user_id}
                        hasPurchased={hasPurchased}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                {averageRating !== null && ratings.length > 0 ? (
                  <>
                    <span className="font-medium">
                      {averageRating.toFixed(1)} / 5
                    </span>
                    <span className="text-slate-400">·</span>
                    <span>{ratings.length} rating{ratings.length === 1 ? '' : 's'}</span>
                  </>
                ) : (
                  <span className="text-slate-400">No ratings yet</span>
                )}
              </div>

              {currentUserId && currentUserId === prompt.user_id && (
                <div className="mt-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/creator/prompts/${prompt.id}/edit`}>Edit this prompt</Link>
                  </Button>
                </div>
              )}

              {prompt.tags && prompt.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {prompt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Share this prompt</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Copy a shareable link or a ready-made snippet to post on social or
                    send to a friend.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton
                    value={promptUrl}
                    label="Copy link"
                    copiedLabel="Link copied"
                    size="sm"
                  />
                  <CopyButton
                    value={shareText}
                    label="Copy title + link"
                    copiedLabel="Copied!"
                    size="sm"
                  />
                  <a
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-sky-500 bg-sky-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-600"
                  >
                    Tweet this
                  </a>
                </div>
              </div>

              <p className="text-base text-slate-700 whitespace-pre-line">{prompt.description}</p>

              <div className="rounded-xl bg-slate-50 p-4">
                <h2 className="mb-2 text-2xl font-semibold">Prompt Text</h2>

                {price === 0 || hasPurchased ? (
                  <>
                    {/* Free or purchased: show full prompt text */}
                    <pre className="mb-4 max-h-[400px] overflow-auto rounded bg-slate-900 p-4 text-sm text-slate-50">
                      {prompt.prompt_text}
                    </pre>

                    <form action={startTestSession}>
                      <input type="hidden" name="prompt_id" value={prompt.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        Test this prompt in chat
                      </button>
                    </form>
                  </>
                ) : (
                  // Paid and not purchased: show a teaser / paywalled view
                  <div className="mb-6 space-y-3 rounded bg-muted p-4">
                    <pre className="max-h-[200px] overflow-hidden text-sm opacity-60 blur-[1px]">
                      {prompt.prompt_text?.slice(0, 400) || "Prompt content is hidden until purchase."}
                    </pre>
                    <div className="rounded-md bg-black/70 p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-white">
                        This is a paid prompt.
                      </p>
                      <p className="mt-1">
                        Purchase to unlock the full prompt text, all versions, and future updates from the creator.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">Ratings &amp; reviews</h2>

            {(price === 0 || hasPurchased || currentUserId === prompt.user_id) && currentUserId && (
              <form
                action={ratePrompt}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
              >
                <input type="hidden" name="prompt_id" value={prompt.id} />

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium" htmlFor="rating">
                    Your rating
                  </label>
                  <select
                    id="rating"
                    name="rating"
                    defaultValue={currentUserRating?.rating ?? ''}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="1">1 – Poor</option>
                    <option value="2">2 – Fair</option>
                    <option value="3">3 – Good</option>
                    <option value="4">4 – Very good</option>
                    <option value="5">5 – Excellent</option>
                  </select>
                  {currentUserRating && (
                    <span className="text-xs text-slate-500">
                      You rated this {currentUserRating.rating}/5
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" htmlFor="comment">
                    Optional comment
                  </label>
                  <textarea
                    id="comment"
                    name="comment"
                    defaultValue={currentUserRating?.comment ?? ''}
                    rows={3}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Share how this prompt worked for you..."
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-50 hover:bg-slate-800"
                  >
                    Save rating
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {ratings.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No reviews yet. Be the first to rate this prompt.
                </p>
              ) : (
                ratings.map((r, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-slate-100 bg-white p-3 text-sm"
                  >
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {r.rating ?? '–'}/5
                      </span>
                      {r.created_at && (
                        <span>
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {r.comment && (
                      <p className="text-slate-700">{r.comment}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Version history */}
          {(currentUserId === prompt.user_id || hasPurchased || price === 0) &&
            versions.length > 0 && (
              <div className="mt-10 space-y-4">
                <h2 className="text-xl font-semibold">Version history</h2>
                <p className="text-sm text-slate-500">
                  {currentUserId === prompt.user_id
                    ? "You’re seeing all versions you’ve saved for this prompt."
                    : "This prompt’s creator keeps it updated over time. Here’s a history of changes."}
                </p>

                <div className="space-y-3">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-slate-700">
                            {new Date(v.created_at).toLocaleString()}
                          </span>
                          {v.notes && (
                            <span className="text-xs text-slate-500">
                              {v.notes}
                            </span>
                          )}
                        </div>
                        {currentUserId === prompt.user_id && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            Saved by creator
                          </span>
                        )}
                      </div>

                      {v.content && (
                        <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-950/90 p-2 text-[11px] text-slate-50">
                          {v.content.length > 600
                            ? `${v.content.slice(0, 600)}…`
                            : v.content}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {relatedPrompts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-semibold mb-4">Related Prompts</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {relatedPrompts.map((rp) => (
                  <Link key={rp.id} href={`/prompts/${rp.id}`}>
                    <Card className="hover:shadow-md transition-all">
                      <PromptPreviewImage src={rp.previewImage} alt={rp.title} />
                      <CardContent className="p-3">
                        <h3 className="font-medium text-sm line-clamp-2">{rp.title}</h3>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {alsoBoughtPrompts.length > 0 && (
            <div className="mt-12 space-y-4">
              <h2 className="text-xl font-semibold">
                People who bought this also bought
              </h2>
              <p className="text-sm text-slate-500">
                Based on real purchase patterns from other buyers.
              </p>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {alsoBoughtPrompts.map((p) => {
                  const priceNumber = p.price ?? 0;
                  const priceDisplay =
                    priceNumber > 0 ? `$${priceNumber.toFixed(2)}` : "Free";

                  return (
                    <Link
                      key={p.id}
                      href={`/prompts/${p.id}`}
                      className="group"
                    >
                      <div className="overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-150 hover:-translate-y-1 hover:shadow-md">
                        <PromptPreviewImage
                          src={p.previewImage}
                          alt={p.title}
                          className="h-32"
                        />
                        <div className="p-3 space-y-2 text-xs">
                          <div className="line-clamp-2 text-sm font-medium text-slate-800">
                            {p.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {priceDisplay}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              {p.alsoBoughtCount} co-purchase
                              {p.alsoBoughtCount === 1 ? "" : "s"}
                            </span>
                            {Array.isArray(p.tags) &&
                              p.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500"
                                >
                                  #{tag}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <ClientSections prompt={prompt} ratings={ratings} />
        </main>

        <aside className="space-y-4">
          <ActionPanel prompt={prompt} salesCount={salesCount} averageRating={averageRating} ratingCount={ratings.length} />
          <VersionsCard versions={versions} latestContent={prompt.prompt_text} />
        </aside>
      </div>
    </div>
  );
}

type VersionsCardProps = {
  versions: PromptVersion[];
  latestContent: string;
};

function VersionsCard({ versions, latestContent }: VersionsCardProps) {
  if (!versions.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Versions</h3>
        <p className="mt-2 text-sm text-slate-600">No versions yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Versions</h3>
      <ul className="mt-4 space-y-3">
        {versions.map((version) => (
          <li key={version.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-900">
                {new Date(version.created_at).toLocaleString()}
              </div>
              <VersionDiff latestContent={latestContent} content={version.content ?? ''} />
            </div>
            {version.notes && <p className="mt-2 text-slate-700">{version.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersionDiff({ latestContent, content }: { latestContent: string; content: string }) {
  return (
    <details className="text-xs text-indigo-700">
      <summary className="cursor-pointer select-none">View diff</summary>
      <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 text-slate-700">
        <div>
          <div className="font-semibold text-slate-800">Current</div>
          <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[11px] leading-relaxed text-slate-700">
            {latestContent}
          </pre>
        </div>
        <div>
          <div className="font-semibold text-slate-800">This version</div>
          <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[11px] leading-relaxed text-slate-700">
            {content}
          </pre>
        </div>
      </div>
    </details>
  );
}
