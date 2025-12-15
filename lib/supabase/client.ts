/**
 * Browser/Client Supabase Client
 * Use this in client components, hooks, and browser-side code only
 */

"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
    "These are required to initialize the browser Supabase client."
  );
}

/**
 * Browser Supabase client - use in client components and hooks
 * This client can access the user's session and perform authenticated operations
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export default supabase;

// Re-export commonly used types and functions
export * from "@supabase/supabase-js";
