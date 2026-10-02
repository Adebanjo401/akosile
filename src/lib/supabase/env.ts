export function getSupabaseUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes("your-project")) return undefined;
  return url;
}

export function getSupabasePublishableKey(): string | undefined {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (
    !key ||
    key.includes("your-anon-key") ||
    key.includes("your-publishable-key")
  ) {
    return undefined;
  }
  return key;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
