import { getDb, type AkosileDB } from "@/lib/db";
import { createId, isSupabaseConfigured, nowIso } from "@/lib/utils";
import type { OutboxEntry, SyncMeta } from "@/types";
import { createBrowserClient } from "@/lib/supabase/client";

export const TABLE_MAP = {
  profiles: "profiles",
  categories: "categories",
  accounts: "accounts",
  transactions: "transactions",
  transfers: "transfers",
  exchangeRates: "exchange_rates",
  tasks: "tasks",
  reminders: "reminders",
  healthLogs: "health_logs",
  householdItems: "household_items",
  budgets: "budgets",
} as const;

export type SyncedTable = keyof typeof TABLE_MAP;

/** Push dependents after parents so FKs succeed on a fresh remote. */
const PUSH_RANK: Record<SyncedTable, number> = {
  profiles: 0,
  categories: 1,
  accounts: 2,
  exchangeRates: 3,
  transactions: 4,
  transfers: 5,
  tasks: 6,
  reminders: 7,
  healthLogs: 8,
  householdItems: 9,
  budgets: 10,
};

const MAX_ATTEMPTS = 8;

const CAMEL_TO_SNAKE: Record<string, string> = {
  userId: "user_id",
  baseCurrency: "base_currency",
  firstDayOfWeek: "first_day_of_week",
  quietHoursStart: "quiet_hours_start",
  quietHoursEnd: "quiet_hours_end",
  waterUnit: "water_unit",
  onboardingCompleted: "onboarding_completed",
  parentId: "parent_id",
  sortOrder: "sort_order",
  openingBalanceMinor: "opening_balance_minor",
  accountId: "account_id",
  amountMinor: "amount_minor",
  rateToBase: "rate_to_base",
  amountBaseMinor: "amount_base_minor",
  categoryId: "category_id",
  recurringId: "recurring_id",
  dueDate: "due_date",
  fromAccountId: "from_account_id",
  toAccountId: "to_account_id",
  fromAmountMinor: "from_amount_minor",
  toAmountMinor: "to_amount_minor",
  fromCurrency: "from_currency",
  toCurrency: "to_currency",
  dueAt: "due_at",
  seriesId: "series_id",
  completedAt: "completed_at",
  itemType: "item_type",
  itemId: "item_id",
  fireAt: "fire_at",
  offsetMinutes: "offset_minutes",
  snoozeUntil: "snooze_until",
  loggedAt: "logged_at",
  createdAt: "created_at",
  updatedAt: "updated_at",
  asOf: "as_of",
  estimatedAmountMinor: "estimated_amount_minor",
  transactionId: "transaction_id",
  periodStart: "period_start",
};

const SNAKE_TO_CAMEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([camel, snake]) => [snake, camel]),
);

const NUMERIC_FIELDS = new Set([
  "openingBalanceMinor",
  "amountMinor",
  "rateToBase",
  "amountBaseMinor",
  "fromAmountMinor",
  "toAmountMinor",
  "rate",
  "value",
  "estimatedAmountMinor",
  "offsetMinutes",
  "sortOrder",
  "firstDayOfWeek",
]);

function toSnakePayload(
  table: SyncedTable,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (table === "profiles" && key === "email" && value == null) continue;
    out[CAMEL_TO_SNAKE[key] ?? key] = value;
  }
  if (table === "profiles" && payload.id) {
    out.id = payload.id;
  }
  return out;
}

function toCamelRecord(
  table: SyncedTable,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = SNAKE_TO_CAMEL[key] ?? key;
    if (NUMERIC_FIELDS.has(camel) && value != null && value !== "") {
      out[camel] = Number(value);
    } else {
      out[camel] = value;
    }
  }
  if (table === "transactions" && !out.source) {
    out.source = "manual";
  }
  if (table === "householdItems" && out.dueDate === undefined) {
    out.dueDate = null;
  }
  return out;
}

function syncedDexieTable(db: AkosileDB, table: SyncedTable) {
  switch (table) {
    case "profiles":
      return db.profiles;
    case "categories":
      return db.categories;
    case "accounts":
      return db.accounts;
    case "transactions":
      return db.transactions;
    case "transfers":
      return db.transfers;
    case "exchangeRates":
      return db.exchangeRates;
    case "tasks":
      return db.tasks;
    case "reminders":
      return db.reminders;
    case "healthLogs":
      return db.healthLogs;
    case "householdItems":
      return db.householdItems;
    case "budgets":
      return db.budgets;
    default: {
      const _never: never = table;
      return _never;
    }
  }
}

export async function enqueueUpsert(
  table: SyncedTable,
  recordId: string,
  payload: unknown,
  options?: { flush?: boolean },
): Promise<void> {
  const db = getDb();
  const entry: OutboxEntry = {
    id: createId(),
    table,
    recordId,
    operation: "upsert",
    payload,
    createdAt: nowIso(),
    attempts: 0,
  };
  await db.outbox.add(entry);
  if (options?.flush !== false) void flushOutbox();
}

export async function enqueueDelete(
  table: SyncedTable,
  recordId: string,
  options?: { flush?: boolean },
): Promise<void> {
  const db = getDb();
  const entry: OutboxEntry = {
    id: createId(),
    table,
    recordId,
    operation: "delete",
    payload: null,
    createdAt: nowIso(),
    attempts: 0,
  };
  await db.outbox.add(entry);
  if (options?.flush !== false) void flushOutbox();
}

function sortForPush(entries: OutboxEntry[]): OutboxEntry[] {
  return [...entries].sort((a, b) => {
    const ra = PUSH_RANK[a.table as SyncedTable] ?? 99;
    const rb = PUSH_RANK[b.table as SyncedTable] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function flushOutbox(): Promise<{ pushed: number; failed: number }> {
  if (
    !isSupabaseConfigured() ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  ) {
    return { pushed: 0, failed: 0 };
  }

  const db = getDb();
  const supabase = createBrowserClient();
  if (!supabase) return { pushed: 0, failed: 0 };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { pushed: 0, failed: 0 };

  const pending = sortForPush(await db.outbox.orderBy("createdAt").toArray());
  let pushed = 0;
  let failed = 0;

  for (const entry of pending) {
    const remoteTable = TABLE_MAP[entry.table as SyncedTable];
    if (!remoteTable) {
      await db.outbox.delete(entry.id);
      continue;
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      failed += 1;
      continue;
    }

    try {
      if (entry.operation === "delete") {
        const { error } = await supabase
          .from(remoteTable)
          .delete()
          .eq("id", entry.recordId);
        if (error) throw error;
      } else {
        const payload = toSnakePayload(
          entry.table as SyncedTable,
          entry.payload as Record<string, unknown>,
        );
        const { error } = await supabase.from(remoteTable).upsert(payload);
        if (error) throw error;
      }
      await db.outbox.delete(entry.id);
      pushed += 1;
    } catch (err) {
      failed += 1;
      await db.outbox.update(entry.id, {
        attempts: entry.attempts + 1,
        lastError: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }

  const meta = (await db.syncMeta.get("default")) ?? emptyMeta();
  await db.syncMeta.put({
    ...meta,
    lastPushedAt: nowIso(),
  });

  return { pushed, failed };
}

function emptyMeta(): SyncMeta {
  return { id: "default", lastPulledAt: null, lastPushedAt: null };
}

/**
 * Pull remote rows and merge with last-write-wins on `updatedAt`.
 * Local rows that are newer than the server copy are left alone.
 */
export async function pullRemote(
  options?: { full?: boolean },
): Promise<{ pulled: number }> {
  if (
    !isSupabaseConfigured() ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  ) {
    return { pulled: 0 };
  }

  const supabase = createBrowserClient();
  if (!supabase) return { pulled: 0 };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { pulled: 0 };

  const db = getDb();
  const meta = (await db.syncMeta.get("default")) ?? emptyMeta();
  const cursor = options?.full ? null : meta.lastPulledAt;
  const uid = session.user.id;
  let pulled = 0;

  const tables = Object.keys(TABLE_MAP) as SyncedTable[];
  for (const local of tables) {
    const remote = TABLE_MAP[local];
    let query = supabase.from(remote).select("*");
    if (local === "profiles") {
      query = query.eq("id", uid);
    } else {
      query = query.eq("user_id", uid);
    }
    if (cursor) {
      query = query.gt("updated_at", cursor);
    }

    const { data, error } = await query;
    if (error) {
      console.warn(`Akosile pull failed for ${remote}:`, error.message);
      continue;
    }
    if (!data?.length) continue;

    const table = syncedDexieTable(db, local);
    for (const raw of data) {
      const entity = toCamelRecord(
        local,
        raw as Record<string, unknown>,
      ) as { id: string; updatedAt?: string };
      if (!entity.id) continue;
      const existing = await table.get(entity.id);
      const remoteStamp = entity.updatedAt ?? "";
      const localStamp =
        existing && "updatedAt" in existing
          ? String((existing as { updatedAt?: string }).updatedAt ?? "")
          : "";
      if (existing && localStamp > remoteStamp) continue;
      await table.put(entity as never);
      pulled += 1;
    }
  }

  await db.syncMeta.put({
    ...((await db.syncMeta.get("default")) ?? emptyMeta()),
    lastPulledAt: nowIso(),
  });

  return { pulled };
}

export async function syncNow(): Promise<void> {
  await flushOutbox();
  await pullRemote();
}

export async function getOutboxErrors(): Promise<OutboxEntry[]> {
  const db = getDb();
  const all = await db.outbox.toArray();
  return all.filter((e) => e.lastError);
}

export function startSyncListeners(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onOnline = () => {
    void syncNow();
  };
  window.addEventListener("online", onOnline);
  const interval = window.setInterval(() => {
    void syncNow();
  }, 30_000);

  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(interval);
  };
}

const USER_SCOPED_TABLES = [
  "categories",
  "accounts",
  "transactions",
  "transfers",
  "exchangeRates",
  "tasks",
  "reminders",
  "healthLogs",
  "householdItems",
  "budgets",
] as const satisfies readonly SyncedTable[];

/**
 * Rewrite every local row from a device UUID onto `auth.uid()` so RLS accepts
 * the next push. Call only when the remote profile is still empty of app data.
 */
export async function rebaseLocalUserId(
  fromId: string,
  toId: string,
): Promise<void> {
  if (fromId === toId) return;
  const db = getDb();

  await db.transaction("rw", db.tables, async () => {
    const profile = await db.profiles.get(fromId);
    if (profile) {
      await db.profiles.delete(fromId);
      await db.profiles.put({
        ...profile,
        id: toId,
        updatedAt: nowIso(),
      });
    }

    for (const name of USER_SCOPED_TABLES) {
      const table = syncedDexieTable(db, name);
      const rows = await table.where("userId").equals(fromId).toArray();
      for (const row of rows) {
        const next = {
          ...(row as unknown as Record<string, unknown>),
          userId: toId,
          updatedAt: nowIso(),
        };
        await table.put(next as never);
      }
    }

    const outbox = await db.outbox.toArray();
    for (const entry of outbox) {
      const payload =
        entry.payload && typeof entry.payload === "object"
          ? { ...(entry.payload as Record<string, unknown>) }
          : null;
      if (payload) {
        if (payload.userId === fromId) payload.userId = toId;
        if (entry.table === "profiles" && payload.id === fromId) {
          payload.id = toId;
        }
      }
      await db.outbox.put({
        ...entry,
        recordId:
          entry.table === "profiles" && entry.recordId === fromId
            ? toId
            : entry.recordId,
        payload,
      });
    }
  });
}

/** Queue every local row for push after an identity rebase. */
export async function enqueueAllLocalData(userId: string): Promise<void> {
  const db = getDb();
  const profile = await db.profiles.get(userId);
  if (profile) {
    await enqueueUpsert("profiles", profile.id, profile, { flush: false });
  }
  for (const name of USER_SCOPED_TABLES) {
    const table = syncedDexieTable(db, name);
    const rows = await table.where("userId").equals(userId).toArray();
    for (const row of rows) {
      const id = (row as { id: string }).id;
      await enqueueUpsert(name, id, row, { flush: false });
    }
  }
}
