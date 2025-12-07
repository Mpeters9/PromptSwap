// lib/realtime/types.ts

export type RealtimeMessageType =
  | 'ping'
  | 'signal'
  | 'client-event'
  | 'server-event'
  | 'error'
  | 'welcome';

export type ServerEventKind =
  | 'pong'
  | 'signal-ack'
  | 'client-event-ack';

export interface RealtimeMessage<T = unknown> {
  type: RealtimeMessageType;
  sessionId?: string;
  payload?: T;
}

export interface WelcomePayload {
  connectionId: string;
  message: string;
}

export interface ServerEventPayloadBase {
  kind: ServerEventKind | string;
  ts?: number;
  [key: string]: unknown;
}

export interface PongPayload extends ServerEventPayloadBase {
  kind: 'pong';
}

export interface SignalAckPayload extends ServerEventPayloadBase {
  kind: 'signal-ack';
}

export interface ClientEventAckPayload extends ServerEventPayloadBase {
  kind: 'client-event-ack';
}

export type KnownServerEventPayload =
  | PongPayload
  | SignalAckPayload
  | ClientEventAckPayload;

export type ServerEventMessage = RealtimeMessage<KnownServerEventPayload>;

export type WelcomeMessage = RealtimeMessage<WelcomePayload>;

/**
 * Narrow a parsed message into a server-event payload.
 */
export function isServerEvent(
  msg: RealtimeMessage
): msg is ServerEventMessage {
  return msg.type === 'server-event' && !!msg.payload;
}

/**
 * Narrow a parsed message into a welcome payload.
 */
export function isWelcomeMessage(
  msg: RealtimeMessage
): msg is WelcomeMessage {
  return msg.type === 'welcome' && !!msg.payload;
}
