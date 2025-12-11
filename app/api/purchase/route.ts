import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

type PurchaseBody = {
  promptId?: string;
};

type ProfileRow = {
  credits: number | null;
};

const rateLimitWindowMs = 60_000;
const rateLimitMax = 10;
const purchaseLimiter = new Map<string, { ts: number; count: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const current = purchaseLimiter.get(key);
  if (!current || now - current.ts > rateLimitWindowMs) {
    purchaseLimiter.set(key, { ts: now, count: 1 });
    return false;
  }
  if (current.count >= rateLimitMax) return true;
  current.count += 1;
  return false;
}

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseAdmin || !supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server misconfigured: Supabase URL and service role key are required for purchases.' },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown';
    if (rateLimit(ip)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    let body: PurchaseBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const promptId = body.promptId?.trim();
    if (!promptId) {
      return NextResponse.json({ error: 'promptId_required' }, { status: 400 });
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const userId = sessionData.session.user.id;

    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, title, price, user_id, prompt_text')
      .eq('id', promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json({ error: 'prompt_not_found' }, { status: 404 });
    }

    if (prompt.user_id === userId) {
      return NextResponse.json({ error: 'cannot_buy_own_prompt' }, { status: 400 });
    }

    const { data: existingPurchase, error: purchaseCheckError } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', userId)
      .eq('prompt_id', prompt.id)
      .maybeSingle();

    if (purchaseCheckError) {
      return NextResponse.json({ error: 'purchase_check_failed' }, { status: 500 });
    }

    if (existingPurchase) {
      return NextResponse.json({ error: 'already_owned' }, { status: 400 });
    }

    const price = Math.round(Number(prompt.price ?? 0));

    const { data: buyerProfile, error: buyerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (buyerProfileError || buyerProfile === null) {
      return NextResponse.json({ error: 'buyer_profile_missing' }, { status: 500 });
    }

    const buyerCredits = Number(buyerProfile?.credits ?? 0);

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
    }

    if (buyerCredits < price) {
      return NextResponse.json({ error: 'insufficient_credits' }, { status: 400 });
    }

    const { data: sellerProfile, error: sellerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', prompt.user_id)
      .single();

    if (sellerProfileError || sellerProfile === null) {
      return NextResponse.json({ error: 'seller_profile_missing' }, { status: 500 });
    }

    const sellerCredits = Number(sellerProfile?.credits ?? 0);

    // Attempt to keep updates consistent with manual rollbacks if a later step fails.
    const { data: buyerUpdate, error: buyerUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ credits: buyerCredits - price })
      .eq('id', userId)
      .eq('credits', buyerCredits)
      .select('credits')
      .single();

    if (buyerUpdateError || !buyerUpdate) {
      const insufficient = buyerUpdateError?.code === '23514' || buyerUpdateError?.code === '23505';
      return NextResponse.json({ error: insufficient ? 'insufficient_credits' : 'purchase_failed' }, { status: 400 });
    }

    const { data: sellerUpdate, error: sellerUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ credits: sellerCredits + price })
      .eq('id', prompt.user_id)
      .eq('credits', sellerCredits)
      .select('credits')
      .single();

    if (sellerUpdateError || !sellerUpdate) {
      await supabaseAdmin.from('profiles').update({ credits: buyerCredits }).eq('id', userId);
      return NextResponse.json({ error: 'purchase_failed' }, { status: 500 });
    }

    const { error: insertError } = await supabaseAdmin
      .from('purchases')
      .insert({
        buyer_id: userId,
        seller_id: prompt.user_id,
        prompt_id: prompt.id,
        price,
      })
      .select('id')
      .single();

    if (insertError) {
      await supabaseAdmin.from('profiles').update({ credits: buyerCredits }).eq('id', userId);
      await supabaseAdmin.from('profiles').update({ credits: sellerCredits }).eq('id', prompt.user_id);

      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'already_owned' }, { status: 400 });
      }

      return NextResponse.json({ error: 'purchase_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, content: prompt.prompt_text });
  } catch (err: any) {
    await logError(err, { scope: 'purchase_api' });
    return NextResponse.json({ error: 'purchase_failed' }, { status: 500 });
  }
}
