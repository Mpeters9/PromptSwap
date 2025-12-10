'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type NavItem = {
  label: string;
  href: string;
  authOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Dashboard', href: '/dashboard', authOnly: true },
  { label: 'Purchases', href: '/dashboard/purchases', authOnly: true },
  { label: 'Upload', href: '/dashboard/upload', authOnly: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const hasSession = document.cookie.includes('sb-');
    setIsAuthed(hasSession);
  }, []);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href));

  const links = navItems.filter((item) => (item.authOnly ? isAuthed : true));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            PromptSwap
          </Link>
          <Badge variant="secondary" className="hidden text-xs font-semibold sm:inline-flex">
            Beta
          </Badge>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((item) => (
            <Button
              key={item.href}
              variant={isActive(item.href) ? 'secondary' : 'ghost'}
              asChild
              className="text-sm font-semibold"
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          {isAuthed ? (
            <Button variant="outline" asChild>
              <Link href="/auth/logout">Logout</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
          )}
          <Avatar className="h-9 w-9 bg-slate-100 dark:bg-slate-800" />
        </nav>

      </div>
    </header>
  );
}
