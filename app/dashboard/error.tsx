'use client';

import { useEffect } from 'react';

import { ErrorCard } from '@/components/ErrorCard';

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('Dashboard error boundary caught an error', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <ErrorCard
          title="Couldn't load your dashboard"
          description="Something went wrong while loading your data."
          action={
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              Try again
            </button>
          }
        />
      </div>
    </div>
  );
}
