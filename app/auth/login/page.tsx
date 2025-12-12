'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import Button from '@/components/Buttons';
import ErrorMessage from '@/components/ErrorMessage';
import SocialLoginButtons from '@/components/SocialLoginButtons';
import { supabase } from '@/lib/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to PromptSwap</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to access your account.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <SocialLoginButtons />

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="********"
              />
            </div>

            {error && <ErrorMessage message={error} />}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
