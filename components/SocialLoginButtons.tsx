'use client';

import Button from '@/components/Buttons';
import { supabase } from '@/lib/supabase-client';

// Social login buttons for Google and GitHub
export default function SocialLoginButtons() {
  const handleOAuth = async (provider: 'google' | 'github') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      },
    });
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => handleOAuth('google')}
      >
        Continue with Google
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => handleOAuth('github')}
      >
        Continue with GitHub
      </Button>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="h-px flex-1 bg-slate-200" />
        <span>or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}
