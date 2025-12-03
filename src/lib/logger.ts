import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

type Context = Record<string, unknown>;

export async function logError(error: unknown, context: Context = {}) {
  // Always log to console for visibility in Vercel logs.
  console.error(context, error);

  if (!supabaseAdmin) return;

  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : null;

    await supabaseAdmin.from('app_errors').insert({
      message,
      stack,
      metadata: Object.keys(context).length ? context : null,
    });
  } catch (err) {
    console.error('Failed to persist app error', err);
  }
}
