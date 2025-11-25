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
};

export default function PromptDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrompt = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('prompts')
        .select('id, title, description, price, tags, category')
        .eq('id', params.id)
        .single();
      if (fetchError) {
        setError(fetchError.message);
        setPrompt(null);
      } else {
        setPrompt(data);
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

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Loading prompt...
        </div>
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 shadow-sm">
          {error || 'Prompt not found.'}
        </div>
        <button
          type="button"
          onClick={() => router.push('/marketplace')}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Back to marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{prompt.title}</h1>
            {prompt.category && (
              <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {prompt.category}
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-900">
            ${Number(prompt.price ?? 0).toFixed(2)}
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-700">{prompt.description}</p>

        {prompt.tags && prompt.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {prompt.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6">
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Login to buy
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
