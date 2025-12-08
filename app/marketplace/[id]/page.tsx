import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { PromptCard } from '@/components/PromptCard';
import BuyButton from '@/components/BuyButton';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export default async function PromptDetailPage({ params }: { params: { id: string } }) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      category: true,
      prompt_text: true,
      preview_image: true,
      user: {
        select: { id: true, name: true, avatar_url: true },
      },
    },
  });

  if (!prompt) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">Prompt not found.</h1>
            <Button variant="link" asChild className="mt-3">
              <Link href="/marketplace">Back to marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const moreFromCreator = await prisma.prompt.findMany({
    where: { user_id: prompt.user?.id ?? undefined, NOT: { id: prompt.id } },
    take: 3,
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      category: true,
      preview_image: true,
    },
  });

  const priceLabel = prompt.price && prompt.price > 0 ? `${Math.round(Number(prompt.price))} credits` : 'Free';
  const creatorName = prompt.user?.name ?? 'Creator';
  const creatorAvatar = prompt.user?.avatar_url ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {creatorAvatar ? (
                    <AvatarImage src={creatorAvatar} alt={creatorName} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-semibold text-slate-700">
                      {creatorName.trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                </Avatar>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">{creatorName}</p>
                  <Link
                    href={`/creator/${prompt.user?.id ?? ''}`}
                    className="text-xs text-indigo-600 underline-offset-4 hover:underline"
                  >
                    View profile
                  </Link>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {prompt.title}
              </h1>
              {prompt.description && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {prompt.description}
                </p>
              )}

              {prompt.category && (
                <Badge variant="secondary" className="w-fit">
                  {prompt.category}
                </Badge>
              )}
            </div>

            <div className="flex flex-col items-end gap-3">
              <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">{priceLabel}</Badge>
              <BuyButton
                promptId={prompt.id}
                title={prompt.title}
                price={Number(prompt.price ?? 0)}
                userId={null}
                isCreator={false}
                hasPurchased={false}
              />
            </div>
          </div>

          {prompt.preview_image && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prompt.preview_image}
                alt={prompt.title}
                className="h-64 w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Prompt Preview</p>
            <p className="mt-2 text-sm text-slate-700">
              Purchase to unlock the full prompt content instantly after checkout.
            </p>
          </div>
          </CardContent>
        </Card>
      </motion.div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">More from this creator</h2>
          <Button variant="link" asChild>
            <Link href={`/creator/${prompt.user?.id ?? ''}`}>View profile</Link>
          </Button>
        </div>
        {moreFromCreator.length === 0 ? (
          <p className="text-sm text-slate-600">No other prompts from this creator yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {moreFromCreator.map((item) => (
              <PromptCard
                key={item.id}
                id={item.id}
                title={item.title}
                description={item.description ?? ''}
                price={Number(item.price ?? 0)}
                category={item.category ?? undefined}
                previewImage={item.preview_image ?? undefined}
                authorName={creatorName}
                authorAvatar={creatorAvatar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
