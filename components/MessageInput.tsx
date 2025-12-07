type MessageInputProps = {
  sessionId: string;
  sendUserMessage: (formData: FormData) => Promise<void>;
};

export function MessageInput({
  sessionId,
  sendUserMessage,
}: MessageInputProps) {
  return (
    <form action={sendUserMessage} className="flex items-end gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="flex-1">
        <textarea
          name="content"
          rows={2}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          placeholder="Type your message..."
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
