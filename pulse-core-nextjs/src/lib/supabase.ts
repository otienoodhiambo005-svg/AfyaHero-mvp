import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Client-side Supabase instance.
 * When env vars are absent (dev / CI without .env) the client is created
 * with empty strings — Supabase will reject requests, but the app won't
 * crash at module-import time. Use isSupabaseAvailable() guard before
 * making requests, same as supabase-server.ts.
 */
export const supabase = createClient(supabaseUrl, supabaseKey);

export function isClientSupabaseAvailable(): boolean {
  return supabaseUrl.length > 0 && supabaseKey.length > 0;
}
