import { ReactNode } from "react";
import { getCurrentUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* A simple top bar with a sign out button */}
      <header className="border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Dashboard</h1>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded bg-red-600 px-3 py-1 text-sm hover:bg-red-700"
          >
            Sign Out
          </button>
        </form>
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}
