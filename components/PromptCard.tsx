'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type PromptCardProps = {
  id: string;
  title: string;
  description: string;
  price: number;
  authorName?: string | null;
  authorAvatar?: string | null;
  category?: string | null;
  previewImage?: string | null;
};

const formatPrice = (price: number) => {
  if (!Number.isFinite(price) || price <= 0) return 'Free';
  return `${Math.round(price)} credits`;
};

export function PromptCard({
  id,
  title,
  description,
  price,
  authorName,
  authorAvatar,
  category,
  previewImage,
}: PromptCardProps) {
  const priceLabel = useMemo(() => formatPrice(price), [price]);
  const creatorInitial = (authorName || 'C').trim().charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <Card className="group h-full overflow-hidden border-slate-200 shadow-sm">
        <div className="relative h-40 w-full bg-slate-100">
          {previewImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
              No preview
            </div>
          )}
          <Badge className="absolute right-3 top-3 bg-indigo-600 text-white hover:bg-indigo-700">
            {priceLabel}
          </Badge>
        </div>
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold leading-tight text-slate-900 line-clamp-2 dark:text-slate-100">
              <Link href={`/marketplace/${id}`} className="hover:underline">
                {title}
              </Link>
            </h3>
            <p className="text-sm text-slate-600 line-clamp-2 dark:text-slate-300">
              {description || 'No description provided.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Avatar className="h-10 w-10">
              {authorAvatar ? (
                <AvatarImage src={authorAvatar} alt={authorName ?? 'Creator'} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-semibold text-slate-700">
                  {creatorInitial}
                </div>
              )}
            </Avatar>
            <div className="leading-tight">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {authorName || 'Creator'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Instant delivery</p>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2">
            <Badge variant="secondary" className="text-xs font-semibold">
              {category || 'Uncategorized'}
            </Badge>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={`/marketplace/${id}`}>View</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default PromptCard;
