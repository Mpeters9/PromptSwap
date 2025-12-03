/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import { ErrorCard } from '@/components/ErrorCard';

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('Global error boundary caught an error', error);
  }, [error]);

  const isProd = process.env.NODE_ENV === 'production';
  const details =
    !isProd && error?.stack
      ? error.stack
      : !isProd && error?.message
        ? error.message
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-xl">
        <ErrorCard
          title="Something went wrong"
          description="An unexpected error occurred. Please try again or return home."
          action={
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              Go to Home
            </Link>
          }
          details={details}
        />
      </div>
    </div>
  );
}
