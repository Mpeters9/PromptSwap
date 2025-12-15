import { createErrorResponse, ErrorCodes } from '@/lib/api/responses';
import { NextResponse } from 'next/server';

type RateLimitRecord = {
  count: number;
  expires_at: string;
};

export class RateLimitExceeded extends Error {
  constructor(
    public readonly limit: number,
    public readonly scope: string,
    public readonly identifier: string,
    public readonly resetAt: string,
    public readonly requestId: string,
    public readonly userId?: string | null
  ) {
    super(`Rate limit exceeded for ${scope}`);
    this.name = 'RateLimitExceeded';
  }
}

function extractIdentifier(request: Request, userId?: string | null): string {
  if (userId) {
    return `user:${userId}`;
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    'anonymous';

  return `ip:${ip}`;
}

function getWindowKey(scope: string, identifier: string, windowSeconds: number): { key: string; resetAt: string } {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const resetAt = new Date(windowStart + windowSeconds * 1000).toISOString();
  const key = `${scope}:${identifier}:${windowStart}`;
  return { key, resetAt };
}

export async function enforceRateLimit(options: {
  request: Request;
  supabase: any;
  scope: string;
  limit: number;
  windowSeconds: number;
  userId?: string | null;
  requestId?: string;
}) {
  const { request, supabase, scope, limit, windowSeconds, userId, requestId = crypto.randomUUID() } = options;
  const identifier = extractIdentifier(request, userId);
  const { key, resetAt } = getWindowKey(scope, identifier, windowSeconds);

  const { data: existing, error: fetchError } = await supabase
    .from('rate_limits')
    .select('count,expires_at')
    .eq('key', key)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Rate limit lookup failed', { requestId, scope, identifier }, fetchError);
    throw fetchError;
  }

  const now = new Date();
  let count = 0;

  if (!existing || new Date(existing.expires_at) <= now) {
    const { error: upsertError } = await supabase.from('rate_limits').upsert(
      [
        {
          key,
          count: 1,
          expires_at: resetAt,
        },
      ],
      { onConflict: 'key' }
    );

    if (upsertError) {
      console.error('Rate limit upsert failed', { requestId, scope, identifier }, upsertError);
      throw upsertError;
    }

    count = 1;
  } else {
    count = (existing.count ?? 0) + 1;
    const { error: updateError } = await supabase
      .from('rate_limits')
      .update({ count })
      .eq('key', key);

    if (updateError) {
      console.error('Rate limit update failed', { requestId, scope, identifier }, updateError);
      throw updateError;
    }
  }

  if (count > limit) {
    console.warn('Rate limit exceeded', { requestId, scope, identifier, limit, userId });
    throw new RateLimitExceeded(limit, scope, identifier, resetAt, requestId, userId);
  }
}

export function rateLimitResponse(limitExceeded: RateLimitExceeded) {
  return NextResponse.json(
    createErrorResponse(
      ErrorCodes.TOO_MANY_REQUESTS,
      'Too many requests; please try again later.',
      {
        resetAt: limitExceeded.resetAt,
        limit: limitExceeded.limit,
        scope: limitExceeded.scope,
      }
    ),
    {
      status: 429,
      headers: {
        'Retry-After': Math.max(0, Math.ceil(
          (new Date(limitExceeded.resetAt).getTime() - Date.now()) / 1000
        )).toString(),
      },
    }
  );
}
