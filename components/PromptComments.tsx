'use client';

/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

type Comment = {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
};

type Props = {
  promptId: string;
};

export default function PromptComments({ promptId }: Props) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => {
    void fetchComments();
  }, [promptId]);

  const getToken = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session) throw new Error('Not authenticated');
    return data.session.access_token;
  };

  const fetchComments = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/prompts/${promptId}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load comments');
      setComments(data.comments || []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load comments');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/prompts/${promptId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add comment');
      setComments((prev) => [data.comment, ...prev]);
      setText('');
    } catch (err: any) {
      setError(err.message ?? 'Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Comments</h3>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          placeholder={user ? 'Add a comment...' : 'Sign in to comment'}
          disabled={!user || loading}
        />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Basic HTML is escaped for safety.</span>
          <button
            type="submit"
            disabled={!user || loading || !text.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {loading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>

      <ul className="mt-6 space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{c.user_id.slice(0, 6)}…</span>
              <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.comment}</p>
          </li>
        ))}
        {comments.length === 0 && <p className="text-sm text-slate-600">No comments yet.</p>}
      </ul>
    </div>
  );
}
