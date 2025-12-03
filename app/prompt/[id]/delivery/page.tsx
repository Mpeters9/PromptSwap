'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase-client';

type PromptRow = {
  title: string;
  prompt_text: string;
  category: string | null;
};

export default function PromptDeliveryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [prompt, setPrompt] = useState<PromptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return;
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (sessionError || !userId) {
        router.replace('/auth/login');
        return;
      }

      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('id')
        .eq('buyer_id', userId)
        .eq('prompt_id', params.id)
        .maybeSingle();

      if (purchaseError) {
        setError(purchaseError.message);
        setLoading(false);
        return;
      }

      if (!purchase) {
        router.replace(`/marketplace/${params.id}`);
        return;
      }

      const { data: promptData, error: promptError } = await supabase
        .from<PromptRow>('prompts')
        .select('title, prompt_text, category')
        .eq('id', params.id)
        .single();

      if (promptError) {
        setError(promptError.message);
        setLoading(false);
        return;
      }

      setPrompt(promptData);
      setLoading(false);
    };

    void load();
  }, [params?.id, router]);

  const handleCopy = async () => {
    if (!prompt?.prompt_text) return;
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      setCopyMessage('Copied!');
      setTimeout(() => setCopyMessage(null), 2000);
    } catch (err: any) {
      setCopyMessage(err?.message || 'Copy failed');
      setTimeout(() => setCopyMessage(null), 2000);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-700 shadow-sm">
          Loading your prompt...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
        <button
          type="button"
          onClick={() => router.replace('/dashboard')}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!prompt) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{prompt.title}</h1>
          {prompt.category && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {prompt.category}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Copy to clipboard
          </button>
          {copyMessage && <span className="text-xs text-slate-500">{copyMessage}</span>}
        </div>

        <div className="mt-4 rounded-xl bg-gray-100 p-6 font-mono text-sm text-slate-900 shadow-inner whitespace-pre-wrap">
          {prompt.prompt_text}
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.replace('/dashboard')}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
