'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase-client';

type PromptRow = { id: string; title: string; price: number | null; created_at: string };
type PurchaseRow = {
  id: string;
  prompt_id: string | null;
  price: number | null;
  created_at: string;
  prompts: { title: string | null } | null;
};

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [earnings, setEarnings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalSales = useMemo(
    () => purchases.reduce((sum, row) => sum + (Number(row.price) || 0), 0),
    [purchases],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        setError('Please sign in to view your dashboard.');
        setLoading(false);
        return;
      }

      const user = sessionData.session.user;
      setEmail(user.email ?? null);

      const [{ data: promptData, error: promptErr }, { data: purchaseData, error: purchaseErr }] =
        await Promise.all([
          supabase
            .from<PromptRow>('prompts')
            .select('id, title, price, created_at')
            .eq('user_id', user.id),
          supabase
            .from<PurchaseRow>('purchases')
            .select('id, prompt_id, price, created_at, prompts(title)')
            .eq('seller_id', user.id)
            .order('created_at', { ascending: false }),
        ]);

      if (promptErr || purchaseErr) {
        console.error('Dashboard load error', { promptErr, purchaseErr });
        setError(promptErr?.message || purchaseErr?.message || 'Failed to load dashboard.');
        setLoading(false);
        return;
      }

      setPrompts(promptData ?? []);
      setPurchases(purchaseData ?? []);
      setEarnings(
        (purchaseData ?? []).reduce((sum, row) => sum + (Number(row.price) || 0), 0),
      );
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <motion.div
        className="mb-6 flex flex-wrap items-center justify-between gap-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div>
          <p className="text-xs uppercase text-slate-500">Dashboard</p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {loading ? <Skeleton className="h-7 w-40" /> : email || '—'}
          </h1>
        </div>
        <div className="flex gap-3">
          {loading ? (
            <>
              <Skeleton className="h-16 w-32 rounded-xl" />
              <Skeleton className="h-16 w-32 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard label="Earnings" value={`$${earnings.toFixed(2)}`} />
              <StatCard label="Total Sales" value={`$${totalSales.toFixed(2)}`} />
            </>
          )}
        </div>
      </motion.div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-200">{error}</CardContent>
        </Card>
      )}

      <Tabs defaultValue="prompts" className="mt-4">
        <TabsList>
          <TabsTrigger value="prompts">My Prompts</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="mt-4">
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Prompts</CardTitle>
              <Link href="/dashboard/upload" className="text-sm font-semibold text-indigo-600 hover:underline">
                Upload new
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="border-slate-200 dark:border-slate-800">
                      <CardContent className="p-3 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : prompts.length === 0 ? (
                <EmptyState title="No prompts yet" description="Upload your first prompt to get started." />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {prompts.map((prompt) => (
                    <div key={prompt.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{prompt.title}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(prompt.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          ${Number(prompt.price || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Link
                          href={`/prompts/${prompt.id}`}
                          className="text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          href={`/dashboard/prompts/${prompt.id}`}
                          className="text-xs font-semibold text-slate-600 hover:underline"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle>Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border-slate-200 dark:border-slate-800">
                      <CardContent className="p-3 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-24" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : purchases.length === 0 ? (
                <EmptyState title="No purchases yet" description="Sales will appear here." />
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 dark:border-slate-800 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {purchase.prompts?.title || 'Prompt'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(purchase.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                        ${Number(purchase.price || 0).toFixed(2)}
                        {purchase.prompt_id && (
                          <Link
                            href={`/prompt/${purchase.prompt_id}/delivery`}
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            Open
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle>Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard label="Total Earnings" value={`$${earnings.toFixed(2)}`} />
                <StatCard label="Total Sales" value={`$${totalSales.toFixed(2)}`} />
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Earnings are calculated from your prompt sales. Withdrawals and fees may not be reflected.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle>Payouts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Manage your Stripe payouts and view history in the payouts dashboard.
              </p>
              <Link
                href="/dashboard/payouts"
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Open Payouts
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Card className="shadow-none border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <p className="text-xs uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
