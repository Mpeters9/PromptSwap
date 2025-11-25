'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const projectRef = supabaseUrl?.replace(/^https?:\/\//, '').split('.')[0];
const authCookieName = projectRef ? `sb-${projectRef}-auth-token` : 'supabase-auth-token';

function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${authCookieName}=; path=/; max-age=0; SameSite=Lax`;
}

type Props = {
  className?: string;
  label?: string;
};

export default function LogoutButton({ className = '', label = 'Logout' }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    clearAuthCookie();
    setLoading(false);
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    router.push('/auth/login');
  };

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className={`inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500 ${className}`}
      >
        {loading ? 'Logging out...' : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
