import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-600">Moderate prompts, users, and transactions.</p>
      </div>
      <AdminClient />
    </div>
  );
}
