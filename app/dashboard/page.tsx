import ConnectStripeButton from '@/components/ConnectStripeButton';
import ClientDashboard from './ClientDashboard';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  // Server-rendered shell; data is fetched client-side to include auth context.
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Creator Dashboard</h1>
          <p className="text-sm text-slate-600">Track your prompts, sales, and saved items.</p>
        </div>
        <ConnectStripeButton />
      </div>
      <ClientDashboard />
    </div>
  );
}
