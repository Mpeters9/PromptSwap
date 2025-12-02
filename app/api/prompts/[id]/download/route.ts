import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

type PromptRow = {
  id: string;
  user_id: string | null;
  title: string;
  prompt_text: string | null;
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

const safeFilename = (title: string | null | undefined) => {
  const base = (title ?? 'prompt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'prompt'}.txt`;
};

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const accessToken = extractAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const userId = userData?.user?.id ?? null;

  if (userError || !userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: prompt, error: promptError } = await supabase
    .from<PromptRow>('prompts')
    .select('id, user_id, title, prompt_text')
    .eq('id', params.id)
    .single();

  if (promptError || !prompt) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let authorized = prompt.user_id === userId;

  if (!authorized) {
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', userId)
      .eq('prompt_id', prompt.id)
      .maybeSingle();
    authorized = Boolean(purchase);
  }

  if (!authorized) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const filename = safeFilename(prompt.title);
  const content = prompt.prompt_text ?? '';

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
