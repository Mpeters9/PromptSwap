'use client';

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

type Props = {
  promptId: string;
  initialAverage?: number | null;
};

export default function PromptRating({ promptId, initialAverage = null }: Props) {
  const { user } = useUser();
  const [average, setAverage] = useState<number | null>(initialAverage ?? null);
  const [rating, setRating] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAverage(initialAverage ?? null);
  }, [initialAverage]);

  const getToken = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session) throw new Error('Not authenticated');
    return data.session.access_token;
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/prompts/${promptId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit rating');
      setAverage(data.average ?? rating);
    } catch (err: any) {
      setError(err.message ?? 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Rate this prompt</h3>
          <p className="text-sm text-slate-600">Select between 1 and 5 stars.</p>
        </div>
        {average !== null && (
          <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Avg {average.toFixed(1)}
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, idx) => {
          const value = idx + 1;
          const active = value <= rating;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="text-2xl"
              aria-label={`Rate ${value}`}
            >
              <span className={active ? 'text-amber-500' : 'text-slate-300'}>{active ? '★' : '☆'}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !user || !rating}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
        {!user && <span className="text-xs text-slate-500">Sign in to rate.</span>}
      </div>
    </div>
  );
}
