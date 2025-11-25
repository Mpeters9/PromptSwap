'use client';

import Link from 'next/link';

type PromptCardProps = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  tags: string[] | null;
};

function truncate(text: string | null | undefined, length = 120) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

export function PromptCard({ id, title, description, price, category, tags }: PromptCardProps) {
  return (
    <Link
      href={`/marketplace/${id}`}
      className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            ${Number(price ?? 0).toFixed(2)}
          </span>
        </div>
        <p className="text-sm text-slate-600">{truncate(description)}</p>
        <div className="flex flex-wrap gap-2">
          {tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
            >
              {tag}
            </span>
          ))}
          {category && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {category}
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <span className="text-xs font-semibold text-indigo-700 group-hover:underline">View</span>
      </div>
    </Link>
  );
}
