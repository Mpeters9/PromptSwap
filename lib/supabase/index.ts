/**
 * Supabase Client Library - Main Entry Point
 * 
 * This module provides unified Supabase client helpers for both client and server contexts.
 * Choose the right import based on your use case:
 * 
 * - Client components/hooks: import { supabase } from '@/lib/supabase/client'
 * - Server components: import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
 * - Route handlers: import { createSupabaseServerClient } from '@/lib/supabase/server'
 * - Middleware: import { createSupabaseMiddlewareClient } from '@/lib/supabase/server'
 * - Admin operations: import { createSupabaseAdminClient } from '@/lib/supabase/server'
 */




// Re-export client-side helpers
export { supabase as default, supabase } from "./client";

// Re-export server-side helpers
export {
  createSupabaseServerClient,
  getCurrentUser,
  createSupabaseAdminClient,
  createSupabaseMiddlewareClient,
} from "./server";

// Re-export types from supabase-js
export type * from "@supabase/supabase-js";

// Common utility types for the application
export type SupabaseClient = import("@supabase/supabase-js").SupabaseClient;
export type User = import("@supabase/supabase-js").User;
export type Session = import("@supabase/supabase-js").Session;
export type AuthError = import("@supabase/supabase-js").AuthError;
