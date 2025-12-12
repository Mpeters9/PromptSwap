'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import Button from '@/components/Buttons';
import ErrorMessage from '@/components/ErrorMessage';
import SocialLoginButtons from '@/components/SocialLoginButtons';
import { supabase } from '@/lib/supabase-client';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create your PromptSwap account</h1>
          <p className="text-sm text-muted-foreground">
            Start buying and selling prompts in minutes.
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

            <div className="space-y-1">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="********"
              />
            </div>

            {error && <ErrorMessage message={error} />}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing up...' : 'Sign Up'}
            </Button>
          </form>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
