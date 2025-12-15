

import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

import { getCurrentUser } from '@/lib/supabase/server';

type PromptStats = {
  id: string;
  title: string | null;
  views: number | null;
  likes: number | null;
  purchases: number | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY?.trim();

function barWidth(value: number, max: number) {
  if (max <= 0) return '0%';
  return `${Math.min(100, Math.round((value / max) * 100))}%`;
}


export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service key not configured.');
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabaseAdmin
    .from('prompts')
    .select('id, title, views, likes, purchases')
    .eq('user_id', user!.id);

  if (error) {
    throw new Error(error.message);
  }


  const prompts: PromptStats[] = (data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    views: Number(p.views ?? 0),
    likes: Number(p.likes ?? 0),
    purchases: Number(p.purchases ?? 0),
  }));

  const maxViews = Math.max(0, ...prompts.map((p) => p.views ?? 0));
  const maxLikes = Math.max(0, ...prompts.map((p) => p.likes ?? 0));
  const maxPurchases = Math.max(0, ...prompts.map((p) => p.purchases ?? 0));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Analytics</h1>
        <p className="mt-2 text-sm text-slate-600">See performance of your prompts.</p>
      </div>

      {prompts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">No prompts yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  {prompt.title || 'Untitled prompt'}
                </h2>
                <a
                  href={`/prompts/${prompt.id}`}
                  className="text-xs font-semibold text-indigo-600 underline-offset-4 hover:underline"
                >
                  View
                </a>
              </div>

              <div className="space-y-3">
                <StatBar label="Views" value={prompt.views ?? 0} max={maxViews} color="bg-blue-500" />
                <StatBar label="Likes" value={prompt.likes ?? 0} max={maxLikes} color="bg-emerald-500" />
                <StatBar label="Purchases" value={prompt.purchases ?? 0} max={maxPurchases} color="bg-indigo-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: barWidth(value, max) }}
        />
      </div>
    </div>
  );
}
