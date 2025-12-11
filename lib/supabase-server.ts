import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function supabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[supabase-server] Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY."
    );
    throw new Error("Supabase server env not configured");
  }

  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    serviceRoleKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );
}

// Reads the current auth user from Supabase server-side
export async function getCurrentUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
