import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-10 py-12 text-center dark:border-slate-800 dark:bg-slate-900/60">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"
        aria-hidden="true"
      >
        <div className="h-8 w-10 rounded-md bg-slate-300 dark:bg-slate-700" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
