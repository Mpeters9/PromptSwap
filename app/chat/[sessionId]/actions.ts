"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ChatMessageDTO = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
};

export type ChatSessionWithMessagesDTO = {
  session: {
    id: string;
    userId: string | null;
    title: string | null;
    createdAt: Date;
  };
  messages: ChatMessageDTO[];
};

/**
 * Load a chat session and its messages.
 * This will be used by /chat/[sessionId]/page.tsx to hydrate initial UI.
 */
export async function getChatSessionWithMessages(
  sessionId: string
): Promise<ChatSessionWithMessagesDTO | null> {
  if (!sessionId) {
    throw new Error("Missing sessionId");
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) return null;

  return {
    session: {
      id: session.id,
      userId: session.userId ?? null,
      title: session.title ?? null,
      createdAt: session.createdAt ?? new Date(),
    },
    messages: session.messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt ?? new Date(),
    })),
  };
}

/**
 * Append a message to a chat session.
 * We'll call this when:
 *  - user sends a new message
 *  - server receives a reply from OpenAI Realtime
 */
export async function appendChatMessage(params: {
  sessionId: string;
  role: string; // 'user' | 'assistant' | 'system'
  content: string;
}): Promise<ChatMessageDTO> {
  const { sessionId, role, content } = params;

  if (!sessionId) throw new Error("Missing sessionId");
  if (!role) throw new Error("Missing role");
  if (!content) throw new Error("Missing content");

  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      role,
      content,
    },
  });

  // Revalidate the chat page so server components can refetch if needed
  revalidatePath(`/chat/${sessionId}`);

  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt ?? new Date(),
  };
}

/**
 * Convenience: fetch messages only (without session metadata).
 */
export async function getChatMessages(
  sessionId: string
): Promise<ChatMessageDTO[]> {
  if (!sessionId) {
    throw new Error("Missing sessionId");
  }

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt ?? new Date(),
  }));
}

export async function sendUserMessage(formData: FormData): Promise<void> {
  "use server";

  const sessionId = formData.get("sessionId");
  const content = formData.get("content");

  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("Missing or invalid sessionId");
  }

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Message content is required");
  }

  await appendChatMessage({
    sessionId,
    role: "user",
    content: content.trim(),
  });

  // appendChatMessage already revalidates /chat/[sessionId]
}
