'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import PromptCard from '@/components/PromptCard';
import { supabase } from '@/lib/supabase-client';

type Profile = {
  username: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

type PromptRow = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  created_at: string;
};

export default function CreatorPage() {
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return;
      setLoading(true);
      setError(null);

      const { data: profileData, error: profileError } = await supabase
        .from<Profile>('profiles')
        .select('username, bio, avatar_url, created_at')
        .eq('id', params.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      setProfile(profileData || null);

      const { data: promptData, error: promptError } = await supabase
        .from<PromptRow>('prompts')
        .select('id, title, description, price, created_at')
        .eq('user_id', params.id)
        .order('created_at', { ascending: false });

      if (promptError) {
        setError(promptError.message);
        setLoading(false);
        return;
      }

      setPrompts(promptData ?? []);
      setLoading(false);
    };

    void load();
  }, [params?.id]);

  const avatarFallback =
    (profile?.username || params?.id || 'C').trim().charAt(0).toUpperCase();
  const joined =
    profile?.created_at && !Number.isNaN(new Date(profile.created_at).getTime())
      ? new Date(profile.created_at).toLocaleDateString()
      : 'Joined date unavailable';

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-col items-center gap-4 pb-8 text-center">
          <div className="h-20 w-20 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-6 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border border-neutral-200 bg-white shadow-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-col items-center gap-3 pb-8 text-center border-b border-neutral-200">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-xl font-semibold text-neutral-700">
          {avatarFallback}
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">{profile?.username || 'Creator'}</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {profile?.bio || 'This creator has not added a bio yet.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-500">
          <span>Joined {joined}</span>
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          <span>{prompts.length} prompts</span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {prompts.length === 0 ? (
          <div className="col-span-full rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600 shadow-sm">
            No prompts yet.
          </div>
        ) : (
          prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              id={prompt.id}
              title={prompt.title}
              description={prompt.description ?? ''}
              price={Number(prompt.price ?? 0)}
              likes={0}
              authorName={profile?.username || undefined}
              createdAt={prompt.created_at ? new Date(prompt.created_at) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
