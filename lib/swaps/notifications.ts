import { createNotification, notifyMany } from '@/lib/notifications';
import { SwapAction } from './state';

const SWAP_URL = '/swaps';

export async function emitSwapNotifications(
  supabase: any,
  action: SwapAction,
  swap: { requester_id: string; responder_id: string },
  requestId: string
) {
  try {
    if (action === 'accept') {
      await createNotification(supabase, {
        userId: swap.requester_id,
        type: 'swap.accepted',
        title: 'Swap accepted',
        body: 'Your swap request was accepted.',
        url: SWAP_URL,
        requestId,
      });
    } else if (action === 'decline') {
      await createNotification(supabase, {
        userId: swap.requester_id,
        type: 'swap.declined',
        title: 'Swap declined',
        body: 'Your swap request was declined.',
        url: SWAP_URL,
        requestId,
      });
    } else if (action === 'fulfill') {
      await notifyMany(
        supabase,
        [swap.requester_id, swap.responder_id],
        {
          type: 'swap.fulfilled',
          title: 'Swap fulfilled',
          body: 'Your swap has been fulfilled. Check your prompts.',
          url: SWAP_URL,
          requestId,
        }
      );
    } else if (action === 'expire') {
      await notifyMany(
        supabase,
        [swap.requester_id, swap.responder_id],
        {
          type: 'swap.expired',
          title: 'Swap expired',
          body: 'This swap request expired. Start a new swap if you still want to trade.',
          url: SWAP_URL,
          requestId,
        }
      );
    }
  } catch (error) {
    console.error('Failed to emit swap notifications', error);
  }
}
