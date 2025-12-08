import { listChatSessions, createChatSession } from "./actions";
import { SessionList } from "@/components/SessionList";
import { getCurrentUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // If not logged in, you can either redirect to /signin or just show empty.
  // For now we'll just show an empty list if no user.
  const userId = user?.id ?? null;

  const sessions = await listChatSessions(userId);

  // Server action wrapper for the "New chat" form.
  async function createSessionAction() {
    "use server";

    const innerUser = await getCurrentUser();
    const innerUserId = innerUser?.id ?? null;

    await createChatSession({ userId: innerUserId });
    // We rely on createChatSession's revalidatePath("/dashboard")
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Chat Dashboard</h1>
          <p className="text-sm text-gray-500">
            Create a chat session, then open it to talk to the Realtime model.
          </p>
        </div>

        <form action={createSessionAction}>
          <button
            type="submit"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50"
          >
            + New chat
          </button>
        </form>
      </header>

      <section className="border border-gray-200 rounded-lg p-4">
        <SessionList sessions={sessions} />
      </section>
    </main>
  );
}
