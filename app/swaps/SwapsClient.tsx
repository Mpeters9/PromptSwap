'use client';

import { useEffect, useMemo, useState } from 'react';


import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';

type Swap = {
  id: string;
  requester_id: string;
  responder_id: string;
  requested_prompt_id: string;
  offered_prompt_id: string;
  status: string;
  created_at: string;
  requested_prompt?: PromptMeta | null;
  offered_prompt?: PromptMeta | null;
};

type PromptMeta = {
  id: string;
  title: string;
  preview_image?: string | null;
  price?: number | null;
  user_id?: string | null;
};

type SwapsResponse = {
  incoming: Swap[];
  outgoing: Swap[];
  error?: string;
};

export default function SwapsClient() {
  const { user, loading } = useUser();
  const [incoming, setIncoming] = useState<Swap[]>([]);
  const [outgoing, setOutgoing] = useState<Swap[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: 'accept' | 'decline' | 'cancel' | 'fulfill' } | null>(null);

  useEffect(() => {
    if (!loading && user) {
      void fetchSwaps();
    }
  }, [loading, user]);

  const authorizedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error('Not authenticated');
    return fetch(input, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  const fetchSwaps = async () => {
    setStatus('Loading swaps...');
    setError(null);
    try {
      const res = await authorizedFetch('/api/swaps');
      const data: SwapsResponse = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load swaps');
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
      setStatus(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load swaps');
      setStatus(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const actionLabel = confirm.action.charAt(0).toUpperCase() + confirm.action.slice(1);
    setStatus(`${actionLabel} swap...`);
    setError(null);
    try {
      const res = await authorizedFetch(`/api/swaps/${confirm.id}/${confirm.action}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${confirm.action} swap`);
      await fetchSwaps();
      setConfirm(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to update swap');
    } finally {
      setStatus(null);
    }
  };

  const incomingRequested = useMemo(() => incoming.filter((s) => s.status === 'requested'), [incoming]);

  if (!user && !loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        Please sign in to view swaps.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {status && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{status}</div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Incoming Requests</h2>
          <span className="text-xs text-slate-500">{incomingRequested.length} requested</span>
        </div>
        {incoming.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No incoming swaps.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {incoming.map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                isIncoming
                onAction={(action) => setConfirm({ id: swap.id, action })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Outgoing Requests</h2>
          <span className="text-xs text-slate-500">{outgoing.length} sent</span>
        </div>
        {outgoing.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No outgoing swaps.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {outgoing.map((swap) => (
              <SwapCard key={swap.id} swap={swap} onAction={(action) => setConfirm({ id: swap.id, action })} />
            ))}
          </div>
        )}
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Confirm</h3>
            <p className="mt-2 text-sm text-slate-700">
              Are you sure you want to {confirm.action} this swap?
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SwapCard({
  swap,
  isIncoming = false,
  onAction,
}: {
  swap: Swap;
  isIncoming?: boolean;
  onAction?: (action: 'accept' | 'decline' | 'cancel' | 'fulfill') => void;
}) {
  const statusColor =
    swap.status === 'accepted'
      ? 'bg-emerald-50 text-emerald-700'
      : swap.status === 'declined' || swap.status === 'cancelled'
        ? 'bg-red-50 text-red-700'
        : swap.status === 'fulfilled'
          ? 'bg-blue-50 text-blue-700'
          : 'bg-amber-50 text-amber-700';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>{swap.status}</div>
        <div className="text-xs text-slate-500">{new Date(swap.created_at).toLocaleString()}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PromptBadge label="You give" prompt={swap.offered_prompt} />
        <PromptBadge label="You get" prompt={swap.requested_prompt} />
      </div>

      {isIncoming && swap.status === 'requested' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAction?.('accept')}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => onAction?.('decline')}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-red-200 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Reject
          </button>
        </div>
      )}

      {!isIncoming && swap.status === 'requested' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAction?.('cancel')}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-red-200 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      )}

      {swap.status === 'accepted' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAction?.('fulfill')}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Fulfill
          </button>
        </div>
      )}
    </div>
  );
}

function PromptBadge({ prompt, label }: { prompt?: PromptMeta | null; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{prompt?.title ?? 'Unknown prompt'}</p>
      <p className="text-xs text-slate-500">{prompt?.price ? `$${prompt.price.toFixed(2)}` : 'Free'}</p>
    </div>
  );
}
