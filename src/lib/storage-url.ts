import { supabase } from '@/integrations/supabase/client';

// In-memory cache for signed URLs (private buckets)
const cache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(bucket: string, path: string, expiresIn = 60 * 60 * 24 * 7): Promise<string> {
  if (!path) return '';
  // Already a full URL (legacy rows)
  if (/^https?:\/\//i.test(path)) return path;
  const key = `${bucket}/${path}`;
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && cached.expires > now + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return '';
  cache.set(key, { url: data.signedUrl, expires: now + expiresIn * 1000 });
  return data.signedUrl;
}

export function useSignedUrls() {
  return { getSignedUrl };
}
