import SwapsClient from './SwapsClient';

export const dynamic = 'force-dynamic';

export default function SwapsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Swaps</h1>
        <p className="text-sm text-slate-600">Manage incoming and outgoing prompt swaps.</p>
      </div>
      <SwapsClient />
    </div>
  );
}
