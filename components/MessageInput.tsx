type MessageInputProps = {
  sessionId: string;
  sendUserMessage: (formData: FormData) => Promise<unknown>;
};

export function MessageInput({
  sessionId,
  sendUserMessage,
}: MessageInputProps) {
  return (
    <form
      action={sendUserMessage}
      className="mt-3 flex flex-col gap-2 border-t border-gray-200 pt-3"
    >
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="flex gap-2">
        <textarea
          name="content"
          rows={2}
          className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your message…"
        />

        <button
          type="submit"
          className="self-end inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  );
}
