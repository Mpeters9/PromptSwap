import { randomUUID } from 'crypto';

export function getRequestId(req: Request): string {
  const header = req.headers.get('x-request-id');
  return header && header.trim().length > 0 ? header.trim() : randomUUID();
}

export function withRequestIdHeader(response: Response, requestId: string): Response {
  response.headers.set('x-request-id', requestId);
  return response;
}
