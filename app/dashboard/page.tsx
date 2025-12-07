import { listChatSessions, createChatSession } from "./actions";
import { SessionList } from "@/components/SessionList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // TODO: later we'll pass the Supabase user id here.
  const sessions = await listChatSessions();

  // Server action wrapper for the "New chat" form.
  // We keep this inline so it can call createChatSession and revalidate the page.
  async function createSessionAction() {
    "use server";
    await createChatSession({});
    // We rely on createChatSession's revalidatePath("/dashboard")
    // to refresh the session list. No redirect yet.
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
