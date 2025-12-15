import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { createErrorResponse, createSuccessResponse, ErrorCodes } from '@/lib/api/responses';
import { getRequestId, withRequestIdHeader } from '@/lib/api/request-id';
import { logger } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseNumber(value: string | null, fallback?: number) {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseTags(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const tags = value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const url = req.nextUrl;
  const q = url.searchParams.get('q');
  const sort = (url.searchParams.get('sort') || 'new').toLowerCase();
  const tags = parseTags(url.searchParams.get('tags'));
  const priceMin = parseNumber(url.searchParams.get('priceMin'));
  const priceMax = parseNumber(url.searchParams.get('priceMax'));
  const page = Math.max(1, parseNumber(url.searchParams.get('page'), 1) || 1);
  const pageSize = Math.min(50, Math.max(1, parseNumber(url.searchParams.get('pageSize'), 12) || 12));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    let query = supabase
      .from('prompts')
      .select('id,title,description,price,tags,preview_image,created_at,likes,user_id', { count: 'exact' })
      .eq('is_public', true);

    if (q) {
      query = query.textSearch('search_vector', q, { type: 'websearch' });
    }

    if (tags?.length) {
      query = query.contains('tags', tags);
    }

    if (priceMin !== undefined) {
      query = query.gte('price', priceMin);
    }

    if (priceMax !== undefined) {
      query = query.lte('price', priceMax);
    }

    switch (sort) {
      case 'top':
        query = query.order('likes', { ascending: false }).order('created_at', { ascending: false });
        break;
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      logger.error('Prompt search failed', { requestId, route: '/api/prompts/search', userId: user?.id }, error, 'PROMPT_SEARCH_FAILED');
      const res = NextResponse.json(
        createErrorResponse(ErrorCodes.DATABASE_ERROR, 'Failed to search prompts', { message: error.message }),
        { status: 500 }
      );
      return withRequestIdHeader(res, requestId);
    }

    const res = NextResponse.json(
      createSuccessResponse({
        items: data ?? [],
        page,
        pageSize,
        total: count ?? 0,
      }),
      { status: 200 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  } catch (err: any) {
    logger.error(
      'Prompt search unexpected error',
      { requestId, route: '/api/prompts/search', error: err?.message },
      err as Error,
      'PROMPT_SEARCH_CRASH'
    );
    const res = NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to search prompts'),
      { status: 500 }
    );
    return withRequestIdHeader(res, requestId);
  }
}
