import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY?.trim();
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];

type Body = {
  title?: string;
  description?: string | null;
  price?: number | null;
  category?: string | null;
  prompt_text?: string;
  tags?: string[] | null;
  preview_image?: string | null;
};

function extractAccessToken(): string | null {
  if (!projectRef) return null;
  const store = cookies();
  const cookieName = `sb-${projectRef}-auth-token`;
  const value = store.get(cookieName)?.value ?? store.get('supabase-auth-token')?.value;
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

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const accessToken = extractAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const title = (body.title ?? '').trim();
  const promptText = (body.prompt_text ?? '').trim();

  if (!title || !promptText) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const insertPayload = {
    user_id: userData.user.id,
    title,
    description: body.description ?? null,
    category: body.category ?? null,
    price: body.price ?? null,
    prompt_text: promptText,
    tags: Array.isArray(body.tags) ? body.tags : null,
    preview_image: body.preview_image ?? null,
  };

  const { data, error: insertError } = await supabaseAdmin
    .from('prompts')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { error: insertError?.message ?? 'failed_to_create' },
      { status: 500 },
    );
  }

  return NextResponse.json({ redirect: `/prompt/${data.id}` });
}
