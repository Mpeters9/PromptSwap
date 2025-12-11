import { cookies } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];


async function extractAccessToken(): Promise<string | null> {
  if (!projectRef) return null;
  const cookieStore = await cookies();
  const cookieName = `sb-${projectRef}-auth-token`;
  const value = cookieStore.get(cookieName)?.value ?? cookieStore.get("supabase-auth-token")?.value;
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

async function getUserId(): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const accessToken = await extractAccessToken();
  if (!accessToken) return null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user.id;
}

export default async function PurchasesPage() {
  const userId = await getUserId();
  if (!userId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-700">Please sign in to view your purchases.</p>
          <div className="mt-3 flex justify-center gap-2 text-sm font-semibold">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm transition hover:bg-indigo-700"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const orders = await prisma.purchase.findMany({
    where: { buyerId: userId },
    include: { prompt: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Your Purchases</h1>
        <p className="mt-2 text-sm text-slate-600">Access the prompts you&apos;ve purchased.</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">No purchases found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {order.prompt?.title ?? 'Prompt'}
                </p>
                <p className="text-xs text-slate-500">
                  Purchased{' '}
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString()
                    : 'Unknown date'}
                </p>
              </div>
              {order.prompt?.id && (
                <Link
                  href={`/prompts/${order.prompt.id}`}
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  View content
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
