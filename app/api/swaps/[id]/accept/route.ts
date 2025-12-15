import { handleSwapAction } from '@/app/api/swaps/_transition';

export const runtime = 'nodejs';

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleSwapAction(_req, id, 'accept');
}
