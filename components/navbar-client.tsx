"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InitialUser = {
  id: string;
  email?: string | null;
} | null;

type Notification = {
  id: string;
  title: string;
  body: string;
  url?: string | null;
  is_read: boolean;
  created_at: string;
};

type Props = {
  initialUser: InitialUser;
};


export default function NavbarClient({ initialUser }: Props) {
  const [user, setUser] = useState(initialUser);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
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

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setNotificationsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=10');
      if (!res.ok) return;
      const payload = await res.json();
      setNotifications(payload?.data?.notifications ?? []);
      setUnreadCount(payload?.data?.unreadCount ?? 0);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      void loadNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user?.id, loadNotifications]);

  const markAsRead = async (id: string) => {
    if (!user) return;
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }

    setNotifications((prev) => {
      const wasUnread = prev.some((n) => n.id === id && !n.is_read);
      if (wasUnread) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      return prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    });
  };

  const markAllRead = async () => {
    if (!user) return;
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
    } catch (err) {
      console.error('Failed to mark notifications read', err);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const renderNotifications = () => {
    if (notificationsLoading) {
      return <div className="p-3 text-sm text-muted-foreground">Loading...</div>;
    }

    if (notifications.length === 0) {
      return <div className="p-3 text-sm text-muted-foreground">You&rsquo;re all caught up.</div>;
    }

    return notifications.map((n) => {
      const content = (
        <div key={n.id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{n.title}</span>
            {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />}
          </div>
          <p className="text-xs text-muted-foreground">{n.body}</p>
          <div className="flex items-center gap-2 text-xs">
            {n.url && (
              <Link
                href={n.url}
                className="text-primary hover:underline"
                onClick={() => {
                  void markAsRead(n.id);
                  setNotificationsOpen(false);
                }}
              >
                View
              </Link>
            )}
            {!n.is_read && (
              <button
                onClick={() => void markAsRead(n.id)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Check size={12} /> Mark read
              </button>
            )}
          </div>
        </div>
      );

      return (
        <div
          key={n.id}
          className={`p-3 border-b last:border-b-0 ${n.is_read ? 'bg-background' : 'bg-muted/40'}`}
        >
          {content}
        </div>
      );
    });
  };

  return (
    <div className="flex items-center gap-3 text-sm relative">
      {user ? (
        <>
          {user.email && (
            <span className="text-xs text-muted-foreground">{`Signed in as ${user.email}`}</span>
          )}
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              className="relative"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 rounded-full bg-primary text-white text-[10px] px-1">
                  {unreadCount}
                </span>
              )}
            </Button>
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-md border bg-popover shadow-md z-50">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm font-semibold">Notifications</span>
                  <button
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                    onClick={() => void markAllRead()}
                    disabled={unreadCount === 0}
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">{renderNotifications()}</div>
              </div>
            )}
          </div>
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
