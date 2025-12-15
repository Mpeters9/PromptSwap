// Server-side error reporting hook (placeholder for Sentry/New Relic/etc.)
// This is a no-op to avoid leaking client bundles; wire up your provider later.
export async function reportError(error: unknown, context?: Record<string, any>) {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  if (process.env.NODE_ENV === 'test') return;
  // Implement provider integration here when ready.
  void error;
  void context;
}
