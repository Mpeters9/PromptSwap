"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will show up in the browser console in dev if env vars are missing.
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Auth will not work."
  );
}

// Define an explicit client type based on createClient
type SupabaseClientType = ReturnType<typeof createClient>;

// Export a browser client that is *typed* as always defined so that
// TypeScript does not force every consumer to handle `null`.
// At runtime, if env vars are missing, this will still warn and the cast
// just avoids noisy TS errors in client components.
export const supabaseBrowserClient: SupabaseClientType =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (null as unknown as SupabaseClientType);

export const supabase = supabaseBrowserClient;
