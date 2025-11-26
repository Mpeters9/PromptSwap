import Link from 'next/link';

type PromptCardProps = {
  id: string;
  title: string;
  description: string;
  price: number;
  authorName?: string;
  createdAt?: Date;
};

const formatPrice = (price: number) => {
  if (!Number.isFinite(price) || price <= 0) return 'Free';
  return `$${price.toFixed(2)}`;
};

const formatDate = (createdAt?: Date) => {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return '—';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(createdAt);
};

export default function PromptCard({
  id,
  title,
  description,
  price,
  authorName,
  createdAt,
}: PromptCardProps) {
  return (
    <Link
      href={`/marketplace/${id}`}
      className="group block h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-200"
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="line-clamp-2 text-sm text-gray-600">
              {description || 'No description provided.'}
            </p>
          </div>
          <span className="shrink-0 text-right text-base font-semibold text-gray-900">
            {formatPrice(price)}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
          <span className="truncate">{authorName ?? 'Unknown author'}</span>
          <span>{formatDate(createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
