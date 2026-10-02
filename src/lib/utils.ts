export { cn } from "cn";
export {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
  } catch {
    return "Africa/Lagos";
  }
}
