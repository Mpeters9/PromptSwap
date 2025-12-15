import { logger } from '@/lib/logging';

export type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  url?: string | null;
  requestId?: string;
};

async function insertNotification(
  supabase: any,
  payload: NotificationInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      url: payload.url ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error(
      'Failed to create notification',
      { requestId: payload.requestId, userId: payload.userId, type: payload.type, error: error.message },
      error as Error,
      'NOTIFICATION_CREATE_FAILED'
    );
    return null;
  }

  return data?.id ?? null;
}

export async function createNotification(
  supabase: any,
  payload: NotificationInput
): Promise<string | null> {
  return insertNotification(supabase, payload);
}

export async function notifyMany(
  supabase: any,
  recipients: string[],
  payload: Omit<NotificationInput, 'userId'>
): Promise<void> {
  const tasks = recipients.map((userId) =>
    insertNotification(supabase, { ...payload, userId })
  );

  await Promise.allSettled(tasks);
}

export async function notifyAdmins(
  supabase: any,
  payload: Omit<NotificationInput, 'userId'>
): Promise<void> {
  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true);

  if (error) {
    logger.error(
      'Failed to load admins for notifications',
      { requestId: payload.requestId, error: error.message },
      error as Error,
      'NOTIFICATION_ADMIN_LOOKUP_FAILED'
    );
    return;
  }

  const adminIds = (admins || []).map((a: any) => a.id).filter(Boolean);
  if (adminIds.length === 0) return;

  await notifyMany(supabase, adminIds, payload);
}
