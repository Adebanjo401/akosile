import { buildDefaultCategories } from "@/lib/categories/defaults";
import { seedMissingCategories } from "@/lib/data/categories";
import { getDb } from "@/lib/db";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  enqueueAllLocalData,
  enqueueUpsert,
  pullRemote,
  rebaseLocalUserId,
  syncNow,
} from "@/lib/sync/engine";
import {
  createId,
  getDeviceTimezone,
  nowIso,
} from "@/lib/utils";
import type { Account, Profile } from "@/types";

export const LOCAL_USER_ID_KEY = "akosile.localUserId";

export function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") return "local-user";
  let id = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (!id) {
    id = createId();
    localStorage.setItem(LOCAL_USER_ID_KEY, id);
  }
  return id;
}

export function persistLocalUserId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_USER_ID_KEY, id);
}

async function remoteHasAppData(userId: string): Promise<boolean> {
  const supabase = createBrowserClient();
  if (!supabase) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.onboarding_completed) return true;
  for (const table of [
    "accounts",
    "transactions",
    "household_items",
    "tasks",
    "budgets",
  ] as const) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

/**
 * Bind the Dexie database to `auth.uid()` after a magic-link session starts.
 * Empty cloud accounts inherit this device's data; accounts that already have
 * rows are pulled instead of overwritten.
 */
export async function bindAuthSession(
  authUserId: string,
  email?: string | null,
): Promise<string> {
  const localId = getOrCreateLocalUserId();
  if (localId === authUserId) {
    const profile = await getDb().profiles.get(authUserId);
    if (profile && email && profile.email !== email) {
      const updated = { ...profile, email, updatedAt: nowIso() };
      await getDb().profiles.put(updated);
      await enqueueUpsert("profiles", updated.id, updated, { flush: false });
    }
    await syncNow();
    return authUserId;
  }

  const cloudHasData = await remoteHasAppData(authUserId);
  if (!cloudHasData) {
    await rebaseLocalUserId(localId, authUserId);
    persistLocalUserId(authUserId);
    const profile = await getDb().profiles.get(authUserId);
    if (profile) {
      const updated = {
        ...profile,
        email: email ?? profile.email ?? null,
        updatedAt: nowIso(),
      };
      await getDb().profiles.put(updated);
    }
    await enqueueAllLocalData(authUserId);
    await syncNow();
    return authUserId;
  }

  persistLocalUserId(authUserId);
  await pullRemote({ full: true });
  await ensureLocalProfile({
    id: authUserId,
    email: email ?? undefined,
  });
  await syncNow();
  return authUserId;
}

export async function ensureLocalProfile(
  overrides?: Partial<Profile>,
): Promise<Profile> {
  const db = getDb();
  const userId = overrides?.id ?? getOrCreateLocalUserId();
  const existing = await db.profiles.get(userId);
  if (existing) {
    await seedMissingCategories(userId);
    const modules: Profile["modules"] = {
      schedule: overrides?.modules?.schedule ?? existing.modules.schedule ?? true,
      money: overrides?.modules?.money ?? existing.modules.money ?? true,
      health: overrides?.modules?.health ?? existing.modules.health ?? true,
      household:
        overrides?.modules?.household ?? existing.modules.household ?? true,
    };
    const needsModulePatch = !("household" in (existing.modules ?? {}));
    if (overrides || needsModulePatch) {
      const updated: Profile = {
        ...existing,
        ...overrides,
        modules,
        updatedAt: nowIso(),
      };
      await db.profiles.put(updated);
      await enqueueUpsert("profiles", updated.id, updated);
      return updated;
    }
    return existing;
  }

  const stamp = nowIso();
  const profile: Profile = {
    id: userId,
    name: overrides?.name ?? "You",
    email: overrides?.email ?? null,
    timezone: overrides?.timezone ?? getDeviceTimezone(),
    locale: overrides?.locale ?? "en-NG",
    baseCurrency: overrides?.baseCurrency ?? "NGN",
    firstDayOfWeek: overrides?.firstDayOfWeek ?? 1,
    role: "user",
    modules: overrides?.modules ?? {
      schedule: true,
      money: true,
      health: true,
      household: true,
    },
    quietHoursStart: null,
    quietHoursEnd: null,
    theme: overrides?.theme ?? "system",
    waterUnit: overrides?.waterUnit ?? "cups",
    onboardingCompleted: overrides?.onboardingCompleted ?? false,
    createdAt: stamp,
    updatedAt: stamp,
  };

  await db.profiles.put(profile);
  await enqueueUpsert("profiles", profile.id, profile);

  const categories = buildDefaultCategories(userId);
  await db.categories.bulkPut(categories);
  for (const cat of categories) {
    await enqueueUpsert("categories", cat.id, cat);
  }

  const defaultAccount: Account = {
    id: createId(),
    userId,
    name: "Cash",
    type: "cash",
    currency: profile.baseCurrency,
    openingBalanceMinor: 0,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.accounts.put(defaultAccount);
  await enqueueUpsert("accounts", defaultAccount.id, defaultAccount);

  return profile;
}

export async function completeOnboarding(input: {
  name: string;
  baseCurrency: string;
  timezone: string;
  modules: Profile["modules"];
}): Promise<Profile> {
  const userId = getOrCreateLocalUserId();
  return ensureLocalProfile({
    id: userId,
    name: input.name.trim() || "You",
    baseCurrency: input.baseCurrency,
    timezone: input.timezone,
    modules: input.modules,
    onboardingCompleted: true,
  });
}
