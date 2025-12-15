import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { GenericSupabaseClient } from '@/lib/supabase-types';

type AdminProfileRow = { is_admin: boolean };

export function getAdminSupabaseClient(): GenericSupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey) as GenericSupabaseClient;
}

function getAuthToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '').trim();
}

export async function getAdminUser(req: NextRequest, supabaseAdmin: GenericSupabaseClient) {
  const token = getAuthToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function assertAdminAccess(userId: string, supabaseAdmin: GenericSupabaseClient) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single<AdminProfileRow>();
  if (error) {
    throw error;
  }
  if (!profile?.is_admin) {
    throw new Error('Forbidden');
  }
}

export function requireAdminSupabaseClient() {
  const supabaseAdmin = getAdminSupabaseClient();
  if (!supabaseAdmin) {
    throw new Error('Supabase admin not configured');
  }
  return supabaseAdmin;
}
