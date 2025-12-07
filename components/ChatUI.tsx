import type { ChatMessageDTO } from "@/app/chat/[sessionId]/actions";
import { MessageInput } from "./MessageInput";

type ChatUIProps = {
  sessionId: string;
  messages: ChatMessageDTO[];
  sendUserMessage: (formData: FormData) => Promise<void>;
};

export function ChatUI({ sessionId, messages, sendUserMessage }: ChatUIProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="text-sm text-gray-500">
            No messages yet. Say hi to start the conversation.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {m.content}
                </div>
                <div className="mt-1 text-[10px] opacity-70 text-right">
                  {new Date(m.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-3 border-t border-gray-200 mt-3">
        <MessageInput sessionId={sessionId} sendUserMessage={sendUserMessage} />
      </div>
    </div>
  );
}
