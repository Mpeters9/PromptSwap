'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
  authOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Dashboard', href: '/dashboard', authOnly: true },
  { label: 'Upload', href: '/dashboard/upload', authOnly: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  // Lightweight auth heuristic: checks for supabase session cookie.
  useEffect(() => {
    const hasSession = document.cookie.includes('sb-');
    setIsAuthed(hasSession);
  }, []);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link href="/" className="text-lg font-semibold text-slate-900 hover:text-indigo-700 transition">
          PromptSwap
        </Link>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:hidden"
          aria-label="Toggle navigation"
        >
          <span className="sr-only">Toggle menu</span>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Nav links */}
        <nav
          className={`${
            open ? 'flex' : 'hidden'
          } absolute left-0 top-full w-full flex-col gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:static sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
        >
          {navItems
            .filter((item) => (item.authOnly ? isAuthed : true))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isActive(item.href)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          {isAuthed ? (
            <Link
              href="/auth/logout"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Logout
            </Link>
          ) : (
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
