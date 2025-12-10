import { supabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function POST() {
  const supabase = await supabaseServer();

  await supabase.auth.signOut();

  redirect("/signin");
}
