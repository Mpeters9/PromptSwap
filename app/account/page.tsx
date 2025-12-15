'use client';

import { useEffect, useState } from 'react';

import LogoutButton from '@/components/LogoutButton';

import { supabase } from '@/lib/supabase/client';

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);

      // Safeguard: if supabase is not initialized, surface a clear error and bail.
      if (!supabase) {
        setError("Supabase client is not initialized. Check NEXT_PUBLIC_SUPABASE_* env vars.");
        setEmail(null);
        setLoading(false);
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getUser();

      if (sessionError) {
        setError(sessionError.message);
        setEmail(null);
        setLoading(false);
        return;
      }

      setEmail(data.user?.email ?? null);
      setError(null);
      setLoading(false);
    };

    void loadUser();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Account</h1>
        <p className="mt-2 text-sm text-slate-600">Manage your account settings.</p>

        <div className="mt-6 space-y-3 text-sm text-slate-700">
          {loading && <p>Loading your info...</p>}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {email && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Email</p>
              <p className="mt-1 font-medium text-slate-900">{email}</p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
