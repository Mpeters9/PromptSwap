'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import BuyButton from '@/components/BuyButton';
import { supabase } from '@/lib/supabase-client';

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  tags: string[] | null;
  category: string | null;
  user_id?: string | null;
};

type Profile = {
  username: string | null;
  avatar_url: string | null;
};

export default function PromptDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [creator, setCreator] = useState<{ id: string; username?: string | null; avatar?: string | null } | null>(null);

  useEffect(() => {
    const fetchPrompt = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('prompts')
        .select('id, title, description, price, tags, category, user_id')
        .eq('id', params.id)
        .single();
      if (fetchError) {
        setError(fetchError.message);
        setPrompt(null);
      } else {
        setPrompt(data);
        if (data?.user_id) {
          const { data: profileData } = await supabase
            .from<Profile>('profiles')
            .select('username, avatar_url')
            .eq('id', data.user_id)
            .single();
          setCreator({
            id: data.user_id,
            username: profileData?.username ?? null,
            avatar: profileData?.avatar_url ?? null,
          });
        }
      }
      setLoading(false);
    };

    const fetchUser = async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user?.id ?? null);
    };

    if (params?.id) {
      void fetchPrompt();
      void fetchUser();
    }
  }, [params?.id]);

  const priceLabel = prompt ? `$${Number(prompt.price ?? 0).toFixed(2)}` : '$0.00';
  const creatorInitial =
    (creator?.username || creator?.id || prompt?.title || 'C').trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-12 dark:bg-neutral-950">
        <div className="w-full max-w-4xl space-y-6 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="h-8 w-2/3 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex-1 space-y-4">
              <div className="h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              <div className="h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-6 w-20 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse"
                  />
                ))}
              </div>
              <div className="h-40 rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
            </div>
            <div className="w-full rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:w-72">
              <div className="h-8 w-24 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              <div className="mt-4 h-10 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              <div className="mt-3 h-3 w-32 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-12 dark:bg-neutral-950">
        <div className="w-full max-w-4xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-800/60 dark:bg-neutral-900">
          <h1 className="text-2xl font-semibold text-red-700 dark:text-red-400">
            {error || 'Prompt not found.'}
          </h1>
          <button
            type="button"
            onClick={() => router.push('/marketplace')}
            className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-12 dark:bg-neutral-950">
      <div className="w-full max-w-4xl space-y-8 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">{prompt.title}</h1>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-full bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100">
                {creatorInitial}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {creator?.username || 'Creator'}
                </span>
                <a
                  href={creator?.id ? `/creator/${creator.id}` : '#'}
                  className="text-xs text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-300"
                >
                  View profile
                </a>
              </div>
            </div>
            {prompt.category && (
              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                {prompt.category}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex-1 space-y-6">
            <p className="text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
              {prompt.description || 'No description provided.'}
            </p>

            {prompt.tags && prompt.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prompt.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-800">
              <div className="pointer-events-none select-none filter blur-sm text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {prompt.description || 'Purchase to unlock full prompt.'}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/85 via-white/75 to-white/85 text-center text-sm font-semibold text-neutral-800 dark:from-neutral-900/90 dark:via-neutral-900/80 dark:to-neutral-900/90 dark:text-neutral-100">
                Purchase to unlock full prompt
              </div>
            </div>
          </div>

          <div className="w-full rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:w-72">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Price</span>
              <span className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">{priceLabel}</span>
            </div>
            <div className="mt-4">
              {userId ? (
                <BuyButton
                  promptId={prompt.id}
                  title={prompt.title}
                  price={Number(prompt.price ?? 0)}
                  userId={userId}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => router.replace('/auth/login')}
                  className="flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Login to buy
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              Instant delivery after purchase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
