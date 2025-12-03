import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // seconds

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase service credentials are required for OG route.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const promptId = params.id;
  if (!promptId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const { data: prompt, error: promptError } = await supabaseAdmin
    .from('prompts')
    .select('title, user_id')
    .eq('id', promptId)
    .maybeSingle();

  if (promptError || !prompt) {
    console.error('OG prompt fetch failed', promptError);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', prompt.user_id ?? '')
    .maybeSingle();

  const title = prompt?.title ? escapeXml(prompt.title) : 'Prompt';
  const creator = profile?.username || prompt?.user_id || 'Creator';
  const brand = 'PromptSwap';

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" rx="24" />
  <g transform="translate(80 120)">
    <text x="0" y="0" fill="#a5b4fc" font-size="28" font-family="Inter, sans-serif" font-weight="600">
      ${brand}
    </text>
    <text x="0" y="90" fill="#e2e8f0" font-size="52" font-family="Inter, sans-serif" font-weight="700">
      ${title}
    </text>
    <text x="0" y="150" fill="#cbd5e1" font-size="28" font-family="Inter, sans-serif" font-weight="500">
      by ${escapeXml(creator)}
    </text>
  </g>
</svg>`;

  return new NextResponse(svg.trim(), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
