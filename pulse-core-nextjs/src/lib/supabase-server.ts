import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using service-role key.
 * ONLY use in API routes / Server Components — never expose on client.
 * Falls back to anon key if service-role key is not set.
 */
function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const key = serviceKey || anonKey;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Singleton server client — null when env vars are missing */
export const supabaseServer = getServerClient();

/** Check if Supabase is available */
export function isSupabaseAvailable(): boolean {
  return supabaseServer !== null;
}
