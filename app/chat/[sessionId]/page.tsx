import { notFound } from "next/navigation";
import {
  getChatSessionWithMessages,
  sendUserMessage,
  type ChatMessageDTO,
} from "./actions";
import { ChatUI } from "@/components/ChatUI";

type ChatPageProps = {
  params: { sessionId: string };
};

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: ChatPageProps) {
  const { sessionId } = params;

  const data = await getChatSessionWithMessages(sessionId);

  if (!data) {
    notFound();
  }

  const { session, messages } = data;

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold truncate">
            {session.title || "Chat session"}
          </h1>
          <p className="text-xs text-gray-500">
            Session ID: <span className="font-mono">{session.id}</span>
          </p>
        </div>
      </header>

      <section className="border border-gray-200 rounded-lg p-4 h-[70vh] flex flex-col">
        <ChatUI
          sessionId={session.id}
          messages={messages as ChatMessageDTO[]}
          sendUserMessage={sendUserMessage}
        />
      </section>
    </main>
  );
}
