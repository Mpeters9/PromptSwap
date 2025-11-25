import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

function extractAccessToken(req: NextRequest): string | null {
  if (!projectRef) return null;
  const cookieName = `sb-${projectRef}-auth-token`;
  const value =
    req.cookies.get(cookieName)?.value ?? req.cookies.get('supabase-auth-token')?.value;
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

export async function middleware(req: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase env vars missing; skipping auth middleware.');
    return NextResponse.next();
  }

  // Allow Supabase OAuth/magic-link callbacks to complete before enforcing auth.
  if (
    req.nextUrl.searchParams.has('code') ||
    req.nextUrl.searchParams.has('access_token') ||
    req.nextUrl.searchParams.has('token_type')
  ) {
    return NextResponse.next();
  }

  const accessToken = extractAccessToken(req);
  if (!accessToken) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*'],
};
