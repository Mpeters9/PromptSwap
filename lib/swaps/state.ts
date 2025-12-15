import { AppError, ErrorCategory } from '@/lib/errors';
import { logger } from '@/lib/logging';

export type SwapRecord = {
  id: string;
  requester_id: string;
  responder_id: string;
  requested_prompt_id: string;
  offered_prompt_id: string;
  status: string;
};

export type SwapAction = 'accept' | 'decline' | 'cancel' | 'fulfill' | 'expire';

const ALLOWED_STATUSES = ['requested', 'accepted', 'declined', 'fulfilled', 'cancelled', 'expired'] as const;

const transitionMap: Record<SwapAction, { from: string[]; to: string; actor: 'requester' | 'responder' | 'either' | 'system' }> = {
  accept: { from: ['requested'], to: 'accepted', actor: 'responder' },
  decline: { from: ['requested'], to: 'declined', actor: 'responder' },
  cancel: { from: ['requested'], to: 'cancelled', actor: 'requester' },
  fulfill: { from: ['accepted'], to: 'fulfilled', actor: 'either' },
  expire: { from: ['requested'], to: 'expired', actor: 'system' },
};

function actorRole(swap: SwapRecord, actorId: string | null) {
  if (!actorId) return 'other';
  if (actorId === swap.requester_id) return 'requester';
  if (actorId === swap.responder_id) return 'responder';
  return 'other';
}

export async function transitionSwap(
  supabase: any,
  swapId: string,
  actorId: string | null,
  action: SwapAction,
  requestId: string,
  opts?: { fulfillHandler?: (swap: SwapRecord) => Promise<void> }
): Promise<{ status: string; swap: SwapRecord }> {
  const meta = transitionMap[action];
  if (!meta) {
    throw new AppError(ErrorCategory.VALIDATION, 'INVALID_ACTION', 'Unsupported swap action', { action }, 400);
  }

  const { data: swap, error: fetchError } = await supabase
    .from('swaps')
    .select('id,requester_id,responder_id,requested_prompt_id,offered_prompt_id,status')
    .eq('id', swapId)
    .maybeSingle();

  if (fetchError || !swap) {
    throw new AppError(ErrorCategory.RESOURCE, 'SWAP_NOT_FOUND', 'Swap not found', { swapId }, 404);
  }

  const role = actorRole(swap, actorId);
  if (meta.actor === 'requester' && role !== 'requester') {
    throw new AppError(ErrorCategory.AUTH, 'FORBIDDEN', 'Only requester may perform this action', {}, 403);
  }
  if (meta.actor === 'responder' && role !== 'responder') {
    throw new AppError(ErrorCategory.AUTH, 'FORBIDDEN', 'Only responder may perform this action', {}, 403);
  }
  if (meta.actor === 'either' && role === 'other') {
    throw new AppError(ErrorCategory.AUTH, 'FORBIDDEN', 'Only participants may perform this action', {}, 403);
  }
  if (meta.actor === 'system' && actorId !== null) {
    throw new AppError(ErrorCategory.AUTH, 'FORBIDDEN', 'System-only action', {}, 403);
  }

  if (!meta.from.includes(swap.status)) {
    throw new AppError(
      ErrorCategory.BUSINESS,
      'INVALID_TRANSITION',
      `Cannot ${action} from status ${swap.status}`,
      { from: swap.status, action },
      409
    );
  }

  const { error: updateError } = await supabase
    .from('swaps')
    .update({ status: meta.to })
    .eq('id', swapId);

  if (updateError) {
    throw new AppError(
      ErrorCategory.EXTERNAL,
      'DATABASE_ERROR',
      'Failed to update swap',
      { details: updateError.message },
      500
    );
  }

  if (meta.to === 'fulfilled' && opts?.fulfillHandler) {
    await opts.fulfillHandler(swap);
  }

  logger.info('Swap transition', { requestId, swapId, action, from: swap.status, to: meta.to, actorId }, 'SWAP_TRANSITION');

  return { status: meta.to, swap };
}

export function isSwapStatus(value: string): boolean {
  return (ALLOWED_STATUSES as readonly string[]).includes(value);
}
