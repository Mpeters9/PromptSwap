import Stripe from 'stripe';

type PageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export const dynamic = 'force-dynamic';

export default async function SuccessPage({ searchParams }: PageProps) {
  const sessionId = typeof searchParams.session_id === 'string' ? searchParams.session_id : null;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  let promptName: string | null = null;

  if (sessionId && stripeSecretKey) {
    try {
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      promptName = (session.metadata?.promptId && `Prompt ${session.metadata.promptId}`) || null;
    } catch (err) {
      console.error('Failed to fetch session', err);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Payment successful!</h1>
      {sessionId && <p className="mt-2 text-sm text-slate-600">Session: {sessionId}</p>}
      {promptName && <p className="mt-2 text-base text-slate-700">Purchased: {promptName}</p>}
      {!sessionId && <p className="mt-2 text-sm text-slate-600">No session ID provided.</p>}
    </div>
  );
}
