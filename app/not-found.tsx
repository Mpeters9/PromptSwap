'use client';

import Link from 'next/link';

import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <EmptyState
          title="404"
          description="We couldn't find that page."
          action={
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              Go to Marketplace
            </Link>
          }
        />
      </div>
    </div>
  );
}
