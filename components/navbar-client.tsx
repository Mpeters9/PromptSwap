"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InitialUser = {
  id: string;
  email?: string | null;
} | null;

type Props = {
  initialUser: InitialUser;
};


export default function NavbarClient({ initialUser }: Props) {
  const [user, setUser] = useState(initialUser);
  const router = useRouter();
  
  // Create Supabase client instance
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let active = true;

    const refreshUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUser(user ? { id: user.id, email: user.email ?? null } : null);
    };

    void refreshUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!active) return;
      setUser(
        session?.user ? { id: session.user.id, email: session.user.email ?? null } : null
      );
    });

    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      {user ? (
        <>
          {user.email && (
            <span className="text-xs text-muted-foreground">{`Signed in as ${user.email}`}</span>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </>
      ) : (
        <>
          <Link className="text-sm text-muted-foreground hover:text-foreground transition" href="/auth/login">
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/auth/signup">Sign up</Link>
          </Button>
        </>
      )}
    </div>
  );
}
