'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import LoadingSpinner from '@/components/LoadingSpinner';
import { supabase } from '@/lib/supabase-client';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

/**
 * Client-side guard for pages/components that require authentication.
 * Wrap your page content with <ProtectedRoute> to redirect unauthenticated users to /auth/login.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/auth/login');
        return;
      }
      setAllowed(true);
      setChecking(false);
    };
    void check();
  }, [router]);

  if (checking) {
    return <LoadingSpinner />;
  }

  if (!allowed) return null;

  return <>{children}</>;
}
