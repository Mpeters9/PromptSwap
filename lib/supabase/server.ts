/**
 * Server-side Supabase Client (RSC/Route Handlers)
 * Use this in server components, route handlers, and server-only code
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is required to initialize Supabase server client.");
}

if (!supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required to initialize Supabase server client."
  );
}

/**
 * Create a server-side Supabase client with proper cookie handling
 * Use this in server components, route handlers, and server-only code
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
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

/**
 * Get the current authenticated user from the server
 * Use this in server components and route handlers to check authentication
 */
export async function getCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("[getCurrentUser] Error fetching user:", error);
      return null;
    }

    return user ?? null;
  } catch (error) {
    console.error("[getCurrentUser] Failed to read current user:", error);
    return null;
  }
}

/**
 * Create an admin client for server-side operations that require service role
 * Only use this for operations that need bypass RLS or admin privileges
 */
export async function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin client.");
  }

  return createServerClient(supabaseUrl!, serviceRoleKey!, {
    cookies: {
      get() {
        return undefined;
      },
      set() {
        // No-op for admin client
      },
      remove() {
        // No-op for admin client
      },
    },
  });
}

/**
 * Middleware helper for Supabase auth in Next.js middleware
 * Use this in middleware.ts for route protection
 */
export async function createSupabaseMiddlewareClient(request: Request) {
  const supabase = createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.headers.get("Cookie")?.match(
            new RegExp(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`)
          );
          return cookie ? cookie.pop() : undefined;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Middleware can't set cookies directly
          // Use NextResponse.cookies.set() instead
        },
        remove(name: string, options: CookieOptions) {
          // Middleware can't set cookies directly
          // Use NextResponse.cookies.set() with maxAge: 0 instead
        },
      },
    }
  );

  return supabase;
}
