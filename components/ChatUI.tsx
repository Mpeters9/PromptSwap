"use client";

import { useCallback } from "react";
import type { ChatMessageDTO } from "@/app/chat/[sessionId]/actions";
import { MessageInput } from "./MessageInput";
import { RealtimeClient } from "@/app/chat/[sessionId]/RealtimeClient";

type ChatUIProps = {
  sessionId: string;
  messages: ChatMessageDTO[];
  sendUserMessage: (formData: FormData) => void | Promise<void>;
};

export function ChatUI({ sessionId, messages, sendUserMessage }: ChatUIProps) {
  const handleServerEvent = useCallback((event: unknown) => {
    // For now, just log. Later we'll handle OpenAI Realtime events here.
    console.log("[ChatUI] server event:", event);
  }, []);

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* WebSocket client: connects to /api/realtime for this session */}
      <RealtimeClient
        sessionId={sessionId}
        onServerEvent={handleServerEvent}
      />

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            No messages yet. Say hi to start the conversation.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="flex flex-col rounded-md bg-gray-50 px-3 py-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-medium">
                  {m.role === "assistant" ? "Assistant" : "You"}
                </span>
                <span className="font-mono">
                  {new Date(m.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {m.content}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Input at the bottom */}
      <MessageInput
        sessionId={sessionId}
        sendUserMessage={sendUserMessage}
      />
    </div>
  );
}
