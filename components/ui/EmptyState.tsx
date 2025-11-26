import React from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white/60 px-10 py-12 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100"
        aria-hidden="true"
      >
        <div className="h-8 w-10 rounded-md bg-gray-300" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
