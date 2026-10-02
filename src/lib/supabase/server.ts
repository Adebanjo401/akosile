import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}

/** shadcn / Supabase Library alias. */
export async function createClient() {
  return createServerSupabaseClient();
}
