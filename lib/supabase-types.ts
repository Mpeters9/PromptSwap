import type { SupabaseClient } from '@supabase/supabase-js';

// A generic / relaxed Supabase client type used for server-side admin helpers.
// We don't care about exact PG schema types in route handlers; we just need
// a client that can query tables by string name.
export type GenericSupabaseClient = SupabaseClient<any, any, any>;
