import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const promptId = Number(id);
  if (!Number.isInteger(promptId)) {
    return NextResponse.json({ error: 'invalid_prompt' }, { status: 400 });
  }

  try {
    const updated = await prisma.prompt.update({
      where: { id: promptId },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    });

    return NextResponse.json({ likes: updated.likes });
  } catch (err: any) {
    console.error('Like update failed', err);
    return NextResponse.json({ error: 'failed_to_like' }, { status: 500 });
  }
}
