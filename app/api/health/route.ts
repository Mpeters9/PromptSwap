import { NextResponse } from 'next/server';
import { getRequestId, withRequestIdHeader } from '@/lib/api/request-id';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const response = NextResponse.json({ ok: true, data: { status: 'healthy' } }, { status: 200 });
  return withRequestIdHeader(response, requestId);
}
