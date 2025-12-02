import { cookies } from 'next/headers';
import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

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

export async function getUser(): Promise<User | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const accessToken = extractAccessToken();
  if (!accessToken) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}
