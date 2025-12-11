import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[supabaseServer] Missing NEXT_PUBLIC_SUPABASE_URL or anon key. Server auth will be disabled."
    );
    throw new Error("Supabase server client is not configured");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll() {
        // No-op in server components to avoid Next.js cookie mutation errors.
      },
    },
  });
}

// Reads the current auth user from Supabase server-side.
export async function getCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch (error) {
    console.error("[getCurrentUser] Failed to read current user", error);
    return null;
  }
}
