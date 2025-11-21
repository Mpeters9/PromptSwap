'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

import type { Prompt, Rating } from './page';

type ClientSectionsProps = {
  prompt: Prompt;
  ratings: Rating[];
};

export default function ClientSections({ prompt, ratings }: ClientSectionsProps) {
  const [localRatings, setLocalRatings] = useState<Rating[]>(ratings);

  const average = useMemo(() => {
    if (!localRatings.length) return null;
    return localRatings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / localRatings.length;
  }, [localRatings]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Comments & Ratings</h3>
        <RatingForm promptId={prompt.id} existingRatings={localRatings} onNewRating={setLocalRatings} />
        <RatingList ratings={localRatings} averageRating={average} />
      </div>
    </div>
  );
}

type ActionPanelProps = {
  prompt: Prompt;
  salesCount: number;
  averageRating: number | null;
  ratingCount: number;
};

export function ActionPanel({ prompt, salesCount, averageRating, ratingCount }: ActionPanelProps) {
  const router = useRouter();
  const { user } = useUser();
  const [testerOpen, setTesterOpen] = useState(false);
  const [forking, setForking] = useState(false);

  const handleBuy = () => {
    router.push(`/api/stripe/checkout-session?promptId=${prompt.id}`);
  };

  const handleFork = async () => {
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }
    setForking(true);
    try {
      const { data, error } = await supabase
        .from('prompts')
        .insert({
          user_id: user.id,
          title: `${prompt.title} (Fork)`,
          description: prompt.description,
          tags: prompt.tags,
          price: prompt.price,
          prompt_text: prompt.prompt_text,
          preview_image: prompt.preview_image,
          is_public: false,
          version: (prompt as any).version ?? 1,
        })
        .select('id')
        .single();
      if (error) throw error;
      router.push(`/prompts/${data.id}`);
    } catch (err) {
      console.error('Failed to fork prompt', err);
    } finally {
      setForking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-slate-500">Price</div>
          <div className="text-2xl font-semibold text-slate-900">
            {prompt.price && prompt.price > 0 ? `$${prompt.price.toFixed(2)}` : 'Free'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-500">Sales</div>
          <div className="text-xl font-semibold text-slate-900">{salesCount}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <span className="font-medium">
          {averageRating !== null ? `${averageRating.toFixed(1)} / 5` : 'No ratings yet'}
        </span>
        {averageRating !== null && <span className="text-xs text-slate-500">({ratingCount} ratings)</span>}
      </div>

      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={() => setTesterOpen(true)}
          className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Test
        </button>
        <button
          type="button"
          onClick={handleBuy}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Buy
        </button>
        <button
          type="button"
          onClick={handleFork}
          disabled={forking}
          className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {forking ? 'Forking...' : 'Fork'}
        </button>

        <PromptTester prompt={prompt} open={testerOpen} onClose={() => setTesterOpen(false)} />
      </div>
    </div>
  );
}

type RatingFormProps = {
  promptId: string;
  existingRatings: Rating[];
  onNewRating: Dispatch<SetStateAction<Rating[]>>;
};

function RatingForm({ promptId, existingRatings, onNewRating }: RatingFormProps) {
  const { user } = useUser();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLeftRating = useMemo(
    () => existingRatings.some((r) => r.user_id === user?.id),
    [existingRatings, user?.id],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (hasLeftRating) {
      setError('You already rated this prompt.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('prompt_ratings').insert({
        prompt_id: promptId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      });
      if (insertError) throw insertError;
      onNewRating([{ user_id: user.id, rating, comment: comment.trim() || null, created_at: new Date().toISOString() }, ...existingRatings]);
      setComment('');
    } catch (err: any) {
      setError(err.message ?? 'Failed to submit rating.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <Link href="/auth/sign-in" className="font-semibold text-indigo-600 hover:text-indigo-700">
          Sign in
        </Link>{' '}
        to leave a rating.
      </div>
    );
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="rating" className="font-medium text-slate-800">
          Rating:
        </label>
        <select
          id="rating"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="rounded-lg border border-slate-200 px-3 py-2"
          disabled={submitting}
        >
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} star{r > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>
      <label className="block text-sm font-medium text-slate-800" htmlFor="comment">
        Comment (optional)
      </label>
      <textarea
        id="comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        placeholder="Leave your feedback..."
        disabled={submitting}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
      >
        {submitting ? 'Submitting...' : 'Submit rating'}
      </button>
    </form>
  );
}

function RatingList({ ratings, averageRating }: { ratings: Rating[]; averageRating: number | null }) {
  if (!ratings.length) {
    return <p className="mt-4 text-sm text-slate-600">No ratings yet. Be the first to share feedback.</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <span className="font-semibold">Average:</span>
        <span>{averageRating?.toFixed(1)}</span>
        <span className="text-xs text-slate-500">({ratings.length} ratings)</span>
      </div>
      <ul className="space-y-3">
        {ratings.map((r, idx) => (
          <li key={`${r.user_id}-${idx}`} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-amber-500" aria-label={`Rated ${r.rating} out of 5`}>
                {Array.from({ length: 5 }).map((_, i) => (i < (r.rating ?? 0) ? '★' : '☆'))}
              </span>
              <span className="text-xs text-slate-500">
                {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
              </span>
            </div>
            {r.comment && <p className="mt-1 text-slate-700">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

type TesterProps = { prompt: Prompt; open: boolean; onClose: () => void };

function PromptTester({ prompt, open, onClose }: TesterProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string | null>(null);

  const handleTest = () => {
    // Mock test harness; replace with real model call.
    setOutput(`Pretend output for input: "${input}"\n\nPrompt:\n${prompt.prompt_text}`);
  };

  return (
    open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-slate-900">Prompt Tester</h4>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Close tester"
            >
              ✕
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="Enter sample input..."
            />
            <button
              type="button"
              onClick={handleTest}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Test
            </button>
            {output && (
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                {output}
              </pre>
            )}
          </div>
        </div>
      </div>
    )
  );
}
