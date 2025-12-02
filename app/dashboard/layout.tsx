import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getUser } from '@/lib/auth';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/prompts', label: 'My Prompts' },
  { href: '/dashboard/purchases', label: 'Purchases' },
  { href: '/dashboard/profile', label: 'Profile' },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-64">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Dashboard
        </div>
        <nav className="flex flex-wrap gap-2 lg:flex-col">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
