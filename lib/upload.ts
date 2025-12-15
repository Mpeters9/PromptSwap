
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'prompt-images';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit; adjust to your project's needs.

/**
 * Upload a preview image and return its public URL.
 * Note: Enforce file size limits client-side to avoid slow uploads or failures.
 */
export async function uploadPreviewImage(file: File, userId: string): Promise<string> {
  if (!file) throw new Error('No file provided.');
  if (!userId) throw new Error('Missing user ID.');

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File is too large. Please upload an image under 5MB.');
  }

  const uniqueName = `${userId}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${encodeURIComponent(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uniqueName, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const url = getPublicUrl(uniqueName);
  if (!url) throw new Error('Failed to generate public URL for uploaded image.');
  return url;
}

/**
 * Return the public URL for a stored object.
 * Note: Ensure the bucket allows public access or use signed URLs instead.
 */
export function getPublicUrl(path: string): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Supabase SDK returns `publicUrl`; mapping to requested `publicURL` naming.
  // @ts-expect-error upstream typing uses `publicUrl`
  return data?.publicUrl ?? data?.publicURL ?? null;
}
