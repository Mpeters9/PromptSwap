import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

import { getUser } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const promptId = params.id;
  if (!promptId) {
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
