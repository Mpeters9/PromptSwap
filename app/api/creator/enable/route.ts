import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

const prisma = new PrismaClient();
const stripe =
  stripeSecretKey && new Stripe(stripeSecretKey, { apiVersion: '2024-11-15' as any });

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

async function getUser() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const accessToken = await extractAccessToken();
  if (!accessToken) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

export async function POST() {
  if (!stripeSecretKey || !stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbProfile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { stripeAccountId: true },
  });

  let accountId = dbProfile?.stripeAccountId ?? null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email ?? undefined,
    });
    accountId = account.id;

    await prisma.profile.update({
      where: { id: user.id },
      data: { stripeAccountId: accountId },
    });
  }

  const refreshUrl = `${siteUrl}/dashboard/payouts?stripe=refresh`;
  const returnUrl = `${siteUrl}/dashboard/payouts?stripe=return`;

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url });
}
