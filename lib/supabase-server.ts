import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function ensureSupabaseEnv() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required to initialize Supabase.");
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required to initialize Supabase."
    );
  }
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  ensureSupabaseEnv();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({
          name,
          value: "",
          ...options,
          maxAge: 0,
        });
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
