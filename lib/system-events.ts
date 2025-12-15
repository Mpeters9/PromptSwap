import { logger } from '@/lib/logging';

export type SystemEventPayload = Record<string, unknown> | null;

export interface SystemEventRecord {
  type: string;
  requestId: string;
  payloadSummary?: SystemEventPayload;
  errorMessage: string;
  context?: string;
}

export async function recordSystemEvent(
  supabase: any,
  event: SystemEventRecord
) {
  try {
    await supabase.from('system_events').insert({
      request_id: event.requestId,
      type: event.type,
      payload_summary: event.payloadSummary ?? null,
      error_message: event.errorMessage,
      context: event.context ?? null,
    });
  } catch (error) {
    logger.error('Failed to record system event', { eventType: event.type, requestId: event.requestId }, error as Error, 'SYSTEM_EVENT_LOG_FAILED');
  }
}
