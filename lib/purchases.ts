export type PurchaseAccessShape = {
  status?: string | null;
};

const ALLOWED_STATUSES = new Set(['paid', 'partially_refunded', 'disputed']);

/**
 * Determines if a purchase allows content download based on its status.
 * - allowed: paid, partially_refunded, disputed
 * - denied: refunded, failed, pending or unknown
 */
export function canDownloadPurchase(purchase: PurchaseAccessShape | null | undefined): boolean {
  if (!purchase?.status) return false;
  return ALLOWED_STATUSES.has(purchase.status.toLowerCase());
}
