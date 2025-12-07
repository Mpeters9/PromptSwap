// lib/realtime/signal.ts

import type {
  RealtimeMessage,
  RealtimeMessageType,
} from './types';

/**
 * Safely parse a raw WebSocket message into a RealtimeMessage.
 */
export function parseRealtimeMessage(raw: unknown): RealtimeMessage | null {
  try {
    if (typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.type !== 'string') return null;
    return parsed as RealtimeMessage;
  } catch {
    return null;
  }
}

/**
 * Build a message in our standard wire format.
 */
export function buildMessage<T = unknown>(params: {
  type: RealtimeMessageType;
  sessionId?: string;
  payload?: T;
}): RealtimeMessage<T> {
  const { type, sessionId, payload } = params;
  return {
    type,
    ...(sessionId ? { sessionId } : {}),
    ...(typeof payload !== 'undefined' ? { payload } : {}),
  };
}

/**
 * Serialize a RealtimeMessage to a JSON string.
 */
export function stringifyMessage<T = unknown>(
  msg: RealtimeMessage<T>
): string {
  return JSON.stringify(msg);
}

/**
 * Build the WebSocket URL for a given sessionId, based on the current window location.
 * (Browser-only helper.)
 */
export function getRealtimeWebSocketUrl(sessionId: string): string {
  if (typeof window === 'undefined') {
    // This is a browser helper; on the server you should construct URL manually.
    throw new Error('getRealtimeWebSocketUrl can only be used in the browser');
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;

  const url = new URL(`${protocol}//${host}/api/realtime`);
  if (sessionId) {
    url.searchParams.set('sessionId', sessionId);
  }

  return url.toString();
}

/**
 * Open a WebSocket to /api/realtime for a given sessionId.
 * This is a thin wrapper; higher-level logic will live in RealtimeClient.ts.
 */
export function openRealtimeWebSocket(sessionId: string): WebSocket {
  const url = getRealtimeWebSocketUrl(sessionId);
  return new WebSocket(url);
}
