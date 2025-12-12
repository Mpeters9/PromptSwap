"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ChatSessionDTO = {
  id: string;
  userId: string | null;
  title: string | null;
  createdAt: Date;
};

type CreateChatSessionInput = {
  userId?: string | null;
  title?: string | null;
};

/**
 * Create a new chat session.
 * NOTE: For now, userId is optional and can be passed in.
 * We will later wire this to Supabase Auth and ignore the client-provided value.
 */
export async function createChatSession(
  input: CreateChatSessionInput = {}
): Promise<ChatSessionDTO> {
  const { userId = null, title = "New chat" } = input;

  const session = await prisma.chatSession.create({
    data: {
      userId,
      title,
    },
  });

  // Revalidate the dashboard so new session appears in the list
  revalidatePath("/dashboard");

  return {
    id: session.id,
    userId: session.userId ?? null,
    title: session.title ?? null,
    createdAt: session.createdAt ?? new Date(),
  };
}

// List chat sessions for a given user. If no user is present, return an empty list.
export async function listChatSessions(
  userId?: string | null
): Promise<ChatSessionDTO[]> {
  if (!userId) {
    return [];
  }

  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId ?? null,
      title: s.title ?? null,
      createdAt: s.createdAt ?? new Date(),
    }));
  } catch (error) {
    console.error("[chat] Failed to list chat sessions", error);
    return [];
  }
}

/**
 * Delete a chat session and all its messages.
 * This uses the `onDelete: Cascade` relation on ChatMessage.
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  if (!sessionId) {
    throw new Error("Missing sessionId");
  }

  await prisma.chatSession.delete({
    where: { id: sessionId },
  });

  revalidatePath("/dashboard");
}
