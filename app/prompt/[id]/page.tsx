import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

import { PurchaseButton } from '@/components/PurchaseButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

async function extractAccessToken(): Promise<string | null> {
  if (!projectRef) return null;
  const cookieStore = await cookies();
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

  const accessToken = await extractAccessToken();

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
    .from('prompts')
    .select('id, title, description, prompt_text, user_id, price')
    .eq('id', params.id)
    .single();

  if (promptError || !prompt) {
    notFound();
  }

  const [{ data: userData }, { data: sellerProfile }] = await Promise.all([
    supabase.auth.getUser(accessToken ?? undefined),
    supabase.from('profiles').select('username').eq('id', prompt.user_id).maybeSingle(),
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
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 grid gap-8 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{prompt.title}</h1>
            <p className="text-sm text-muted-foreground">
              Seller: {sellerProfile?.username || prompt.user_id || 'Unknown seller'}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Description</h2>
              <p className="text-sm text-muted-foreground">
                {prompt.description || 'No description provided.'}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Prompt content</h3>
              <pre className="whitespace-pre-wrap break-words rounded-lg border bg-muted/50 p-4 text-sm text-foreground">
                {prompt.prompt_text}
              </pre>
            </div>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card className="shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-semibold">{formatPrice(prompt.price)}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                One-time purchase. Instant access to full prompt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {owned ? (
                <Badge
                  variant="secondary"
                  className="w-full justify-center bg-emerald-100 text-emerald-800 border-emerald-200"
                >
                  You own this prompt
                </Badge>
              ) : (
                <PurchaseButton promptId={prompt.id} label="Buy with Stripe" />
              )}
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Secure checkout via Stripe.</p>
                <p>Access is tied to your account.</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
