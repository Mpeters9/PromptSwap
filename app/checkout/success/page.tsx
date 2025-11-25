'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { supabase } from '@/lib/supabase-client';

type PromptRow = {
  id: string;
  title: string;
  prompt_text: string;
  tags: string[] | null;
  category: string | null;
};

type PurchaseRow = {
  user_id: string;
  prompt_id: string;
};

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const promptId = useMemo(() => searchParams.get('prompt_id'), [searchParams]);

  const [userId, setUserId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptRow | null>(null);
  const [status, setStatus] = useState<string>('Checking access...');
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      console.log('Success page loaded with prompt_id', promptId);
      if (!promptId) {
        setError('Missing prompt_id in URL.');
        setStatus('');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        console.error('Session check failed', sessionError);
        setError('You must be logged in to view this page.');
        setStatus('');
        setRedirecting(true);
        setTimeout(() => router.replace('/auth/login'), 2000);
        return;
      }

      const currentUserId = sessionData.session.user.id;
      setUserId(currentUserId);

      console.log('Checking purchase for user', currentUserId, 'prompt', promptId);
      const { data: purchaseData, error: purchaseError } = await supabase
        .from<PurchaseRow>('purchases')
        .select('user_id, prompt_id')
        .eq('user_id', currentUserId)
        .eq('prompt_id', promptId)
        .maybeSingle();

      if (purchaseError) {
        console.error('Purchase lookup failed', purchaseError);
        setError(purchaseError.message ?? 'Failed to verify purchase.');
        setStatus('');
        return;
      }

      if (!purchaseData) {
        setError('You do not have access to this prompt.');
        setStatus('Redirecting to marketplace...');
        setRedirecting(true);
        setTimeout(() => router.replace('/marketplace'), 2500);
        return;
      }

      console.log('Purchase confirmed, fetching prompt', promptId);
      const { data: promptData, error: promptError } = await supabase
        .from<PromptRow>('prompts')
        .select('id, title, prompt_text, tags, category')
        .eq('id', promptId)
        .single();

      if (promptError) {
        console.error('Prompt fetch failed', promptError);
        setError(promptError.message ?? 'Failed to fetch prompt.');
        setStatus('');
        return;
      }

      setPrompt(promptData);
      setStatus('');
    };

    void checkAccess();
  }, [promptId, router]);

  const handleDownload = () => {
    if (!prompt) return;
    const blob = new Blob([prompt.prompt_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prompt.title || 'prompt'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      setCopyMessage('Copied to clipboard');
      setTimeout(() => setCopyMessage(null), 2500);
    } catch (err: any) {
      console.error('Copy failed', err);
      setCopyMessage('Copy failed');
      setTimeout(() => setCopyMessage(null), 2500);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-xs uppercase text-slate-500">Checkout</p>
          <h1 className="text-3xl font-semibold text-slate-900">Success</h1>
          <p className="mt-2 text-sm text-slate-600">
            {status || 'Your purchase has been processed.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <a
                href="/marketplace"
                className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1 font-semibold text-red-700 transition hover:bg-red-50"
              >
                Back to Marketplace
              </a>
              <a
                href="/auth/login"
                className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1 font-semibold text-red-700 transition hover:bg-red-50"
              >
                Go to Login
              </a>
            </div>
            {redirecting && (
              <p className="mt-2 text-xs text-red-600">Redirecting...</p>
            )}
          </div>
        )}

        {!prompt && !error && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Verifying your purchase...
          </div>
        )}

        {prompt && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Prompt</p>
              <h2 className="text-xl font-semibold text-slate-900">{prompt.title}</h2>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Prompt Text</p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">
                {prompt.prompt_text}
              </pre>
            </div>

            {(prompt.tags || prompt.category) && (
              <div className="flex flex-wrap gap-2">
                {prompt.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
                  >
                    {tag}
                  </span>
                ))}
                {prompt.category && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {prompt.category}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Copy Prompt
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Download Prompt
              </button>
            </div>

            {copyMessage && (
              <p className="text-xs text-slate-600">
                {copyMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
