import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

let client: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return null;

  client = createSSRBrowserClient(url, key);
  return client;
}

/** shadcn / Supabase Library alias — same browser client. */
export function createClient(): SupabaseClient | null {
  return createBrowserClient();
}
