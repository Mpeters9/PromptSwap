'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

type UseUserReturn = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

// Client-side auth hook; call from client components.
export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error fetching session', error);
      setLoading(false);
      return;
    }
    setUser(data.session?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error('Error fetching session', error);
      }
      setUser(error ? null : data.session?.user ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, refreshUser };
}

type ProtectedRouteProps = {
  children: React.ReactNode;
};

// Client-side guard that redirects unauthenticated users.
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
        Checking authentication...
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
