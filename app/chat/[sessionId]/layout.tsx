import { ReactNode } from "react";
import { getCurrentUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function ChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  return <>{children}</>;
}
