"use client";

import Link from "next/link";

type SessionListItem = {
  id: string;
  userId?: string | null;
  title?: string | null;
  createdAt?: string | Date;
};

type SessionListProps = {
  sessions: SessionListItem[];
};

export function SessionList({ sessions }: SessionListProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No chat sessions yet. Click <span className="font-semibold">New chat</span> to create one.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200">
      {sessions.map((session) => {
        const created =
          session.createdAt instanceof Date
            ? session.createdAt.toLocaleString()
            : new Date(session.createdAt ?? "").toLocaleString();

        return (
          <li key={session.id} className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {session.title || "Untitled chat"}
              </div>
              <div className="text-xs text-gray-500">Created {created}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/chat/${session.id}`}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-900 shadow-sm hover:bg-gray-50"
              >
                Open
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
