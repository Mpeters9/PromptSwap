import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

import { PurchaseButton } from '@/components/PurchaseButton';
import { buildMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Prompt - PromptSwap',
  description: 'View prompt details and purchase securely on PromptSwap.',
  image: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/og`,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

type PromptRow = {
  id: string;
  title: string;
  description: string | null;
  prompt_text: string;
  user_id: string | null;
  price: number | null;
};

type ProfileRow = {
  username: string | null;
};

function extractAccessToken(): string | null {
  if (!projectRef) return null;
  const cookieStore = cookies();
  const cookieName = `sb-${projectRef}-auth-token`;
  const value = cookieStore.get(cookieName)?.value ?? cookieStore.get('supabase-auth-token')?.value;
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return (parsed[0] as string) ?? null;
    if (parsed?.access_token) return parsed.access_token as string;
    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token as string;
  } catch {
    return null;
  }
  return null;
}

function formatPrice(price: number | null) {
  const normalized = Math.max(0, Math.round(Number(price ?? 0)));
  return normalized > 0 ? `${normalized} credits` : 'Free';
}

export default async function PromptPage({ params }: { params: { id: string } }) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing.');
  }

  const accessToken = extractAccessToken();

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });

  const { data: prompt, error: promptError } = await supabase
    .from<PromptRow>('prompts')
    .select('id, title, description, prompt_text, user_id, price')
    .eq('id', params.id)
    .single();

  if (promptError || !prompt) {
    notFound();
  }

  const [{ data: userData }, { data: sellerProfile }] = await Promise.all([
    supabase.auth.getUser(accessToken ?? undefined),
    supabase.from<ProfileRow>('profiles').select('username').eq('id', prompt.user_id).maybeSingle(),
  ]);

  const userId = userData?.user?.id ?? null;

  const isOwner = userId !== null && prompt.user_id === userId;

  let owned = isOwner;

  if (userId && !owned) {
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', userId)
      .eq('prompt_id', prompt.id)
      .maybeSingle();
    owned = Boolean(purchase);
  }

  if (!owned) {
    redirect(`/marketplace/${params.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{prompt.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Seller: {sellerProfile?.username || prompt.user_id || 'Unknown seller'}
            </p>
          </div>
          <div className="text-right">
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
              {formatPrice(prompt.price)}
            </div>
            {!owned && (
              <p className="mt-1 text-xs text-slate-500">Instant access after purchase.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Prompt Content</h2>
          <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
            {prompt.prompt_text}
          </pre>
        </div>
      </div>
    </div>
  );
}
