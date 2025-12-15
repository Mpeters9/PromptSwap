'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { PromptCard } from '@/components/PromptCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';

type FormState = {
  title: string;
  description: string;
  tags: string;
  price: string;
  promptText: string;
  previewFile: File | null;
};

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    tags: '',
    price: '',
    promptText: '',
    previewFile: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: boolean; promptText?: boolean }>({});

  // Redirect unauthenticated users once auth state is known.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [loading, router, user]);

  const tagList = useMemo(
    () =>
      form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags],
  );

  const handleChange = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, previewFile: file }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setFieldErrors({});

    if (!user) {
      router.replace('/auth/sign-in');
      return;
    }

    // Client-side validation
    const missingTitle = !form.title.trim();
    const missingPrompt = !form.promptText.trim();
    if (missingTitle || missingPrompt) {
      setFieldErrors({
        title: missingTitle,
        promptText: missingPrompt,
      });
      setError('Please fill out required fields.');
      return;
    }

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.promptText.trim()) {
      setError('Prompt text is required.');
      return;
    }

    const priceValue =
      form.price.trim() === '' ? null : Number.parseFloat(form.price);
    if (priceValue !== null && Number.isNaN(priceValue)) {
      setError('Price must be a number.');
      return;
    }

    setSubmitting(true);
    setStatus('Uploading preview...');

    let previewUrl: string | null = null;

    if (form.previewFile) {
      const path = `users/${user.id}/${Date.now()}-${encodeURIComponent(form.previewFile.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('prompt-images')
        .upload(path, form.previewFile, { cacheControl: '3600' });

      if (uploadError) {
        setError(`Failed to upload image: ${uploadError.message}`);
        setSubmitting(false);
        setStatus(null);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('prompt-images')
        .getPublicUrl(path);
      previewUrl = publicUrlData?.publicUrl ?? null;
    }

    setStatus('Saving prompt...');

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: null,
      price: priceValue,
      prompt_text: form.promptText.trim(),
      tags: tagList.length ? tagList : null,
      preview_image: previewUrl,
      version: 1,
      status: 'submitted',
    };

    const response = await fetch('/api/prompts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const payloadResult = await response.json();
    if (!response.ok || !payloadResult?.data?.promptId) {
      const errorMessage =
        payloadResult?.error?.message || payloadResult?.message || 'Unknown error';
      setError(`Failed to save prompt: ${errorMessage}`);
      setSubmitting(false);
      setStatus(null);
      return;
    }

    const promptId = payloadResult.data.promptId;

    // Upload prompt file to storage
    const promptTextFile = new Blob([form.promptText.trim()], { type: 'text/plain' });
    const { error: uploadPromptError } = await supabase.storage
      .from('prompts')
      .upload(`${promptId}.txt`, promptTextFile, {
        upsert: true,
      });

    if (uploadPromptError) {
      setError(`Prompt saved, but failed to upload file: ${uploadPromptError.message}`);
      setSubmitting(false);
      setStatus(null);
      return;
    }

    setStatus('Prompt created! Redirecting...');
    router.push(`/prompts/${promptId}`);
  };

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
        Redirecting to sign in...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:py-12">
        <div className="flex-1">
          <Card className="shadow-sm border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle>Publish a new prompt</CardTitle>
              <p className="text-sm text-slate-500">
                Share your best prompts with the community and start earning.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="title">
                    Title *
                  </label>
                  <Input
                    id="title"
                    name="title"
                    required
                    className={fieldErrors.title ? 'border-red-300 focus-visible:ring-red-200' : ''}
                    value={form.title}
                    onChange={handleChange('title')}
                    placeholder="E.g., Product launch email prompt"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="description">
                    Description
                  </label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={form.description}
                    onChange={handleChange('description')}
                    placeholder="Describe what this prompt does and when to use it."
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="tags">
                      Tags (comma separated)
                    </label>
                    <Input
                      id="tags"
                      name="tags"
                      value={form.tags}
                      onChange={handleChange('tags')}
                      placeholder="E.g., email, marketing, launch"
                    />
                    {tagList.length > 0 ? (
                      <div className="text-xs text-slate-500">Parsed tags: {tagList.join(', ')}</div>
                    ) : (
                      <div className="text-xs text-slate-400">No tags added yet.</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="price">
                      Price (optional)
                    </label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={handleChange('price')}
                      placeholder="E.g., 5.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="promptText">
                    Prompt Text *
                  </label>
                  <Textarea
                    id="promptText"
                    name="promptText"
                    rows={6}
                    required
                    className={
                      fieldErrors.promptText ? 'border-red-300 focus-visible:ring-red-200' : ''
                    }
                    value={form.promptText}
                    onChange={handleChange('promptText')}
                    placeholder="Full prompt content..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="preview">
                    Preview Image (optional)
                  </label>
                  <Input
                    id="preview"
                    name="preview"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {form.previewFile && (
                    <div className="text-xs text-slate-500">
                      Selected: {form.previewFile.name} ({Math.round(form.previewFile.size / 1024)} KB)
                    </div>
                  )}
                </div>

                {error && (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {status && !error && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                    {status}
                  </div>
                )}

                <div className="flex items-center justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Uploading...' : 'Publish Prompt'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Live preview column */}
        <div className="lg:sticky lg:top-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut', delay: 0.05 }}
          >
            <Card className="shadow-sm border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <p className="text-xs text-slate-500">Update fields to see your card.</p>
              </CardHeader>
              <CardContent>
                <PromptCard
                  id="preview"
                  title={form.title || 'Untitled prompt'}
                  description={form.description || 'Add a description to see it here.'}
                  price={Number(form.price || 0)}
                  authorName="You"
                  previewImage={
                    form.previewFile ? URL.createObjectURL(form.previewFile) : undefined
                  }
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
