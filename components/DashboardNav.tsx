'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard Home' },
  { href: '/dashboard/prompts', label: 'My Prompts' },
  { href: '/dashboard/upload', label: 'Upload Prompt' },
  { href: '/dashboard/payouts', label: 'Payouts' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between md:hidden">
        <p className="text-sm font-semibold text-slate-900">Navigation</p>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <nav
        className={`mt-3 flex flex-col gap-2 md:mt-0 md:flex-row md:flex-wrap md:items-center md:gap-3 ${
          open ? 'block' : 'hidden md:flex'
        }`}
      >
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              isActive(item.href)
                ? 'bg-indigo-100 text-indigo-800'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
