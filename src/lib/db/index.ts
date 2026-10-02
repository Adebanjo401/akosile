import Dexie, { type EntityTable } from "dexie";
import type {
  Account,
  Budget,
  Category,
  ExchangeRate,
  HealthLog,
  HouseholdItem,
  OutboxEntry,
  Profile,
  Reminder,
  SyncMeta,
  Task,
  Transaction,
  Transfer,
} from "@/types";

export class AkosileDB extends Dexie {
  profiles!: EntityTable<Profile, "id">;
  categories!: EntityTable<Category, "id">;
  accounts!: EntityTable<Account, "id">;
  transactions!: EntityTable<Transaction, "id">;
  transfers!: EntityTable<Transfer, "id">;
  exchangeRates!: EntityTable<ExchangeRate, "id">;
  tasks!: EntityTable<Task, "id">;
  reminders!: EntityTable<Reminder, "id">;
  healthLogs!: EntityTable<HealthLog, "id">;
  householdItems!: EntityTable<HouseholdItem, "id">;
  budgets!: EntityTable<Budget, "id">;
  outbox!: EntityTable<OutboxEntry, "id">;
  syncMeta!: EntityTable<SyncMeta, "id">;

  constructor() {
    super("akosile");

    this.version(1).stores({
      profiles: "id",
      categories: "id, userId, module, archived",
      accounts: "id, userId, archived",
      transactions: "id, userId, accountId, date, type, categoryId",
      transfers: "id, userId, date",
      exchangeRates: "id, userId, currency",
      tasks: "id, userId, status, dueAt, seriesId",
      reminders: "id, userId, status, fireAt, itemId",
      healthLogs: "id, userId, type, loggedAt",
      outbox: "id, createdAt, table",
      syncMeta: "id",
    });

    this.version(2).stores({
      profiles: "id",
      categories: "id, userId, module, archived, [userId+module]",
      accounts: "id, userId, archived",
      transactions:
        "id, userId, accountId, date, type, categoryId, [userId+date]",
      transfers: "id, userId, date",
      exchangeRates: "id, userId, currency, [userId+currency]",
      tasks: "id, userId, status, dueAt, seriesId, [userId+status]",
      reminders: "id, userId, status, fireAt, itemId, [userId+status]",
      healthLogs: "id, userId, type, loggedAt, [userId+type]",
      outbox: "id, createdAt, table",
      syncMeta: "id",
    });

    this.version(3).stores({
      profiles: "id",
      categories: "id, userId, module, archived, [userId+module]",
      accounts: "id, userId, archived",
      transactions:
        "id, userId, accountId, date, type, categoryId, [userId+date]",
      transfers: "id, userId, date",
      exchangeRates: "id, userId, currency, [userId+currency]",
      tasks: "id, userId, status, dueAt, seriesId, [userId+status]",
      reminders: "id, userId, status, fireAt, itemId, [userId+status]",
      healthLogs: "id, userId, type, loggedAt, [userId+type]",
      householdItems: "id, userId, kind, status, [userId+status]",
      outbox: "id, createdAt, table",
      syncMeta: "id",
    });

    this.version(4)
      .stores({
        profiles: "id",
        categories: "id, userId, module, archived, [userId+module]",
        accounts: "id, userId, archived",
        transactions:
          "id, userId, accountId, date, type, categoryId, [userId+date]",
        transfers: "id, userId, date",
        exchangeRates: "id, userId, currency, [userId+currency]",
        tasks: "id, userId, status, dueAt, seriesId, [userId+status]",
        reminders: "id, userId, status, fireAt, itemId, [userId+status]",
        healthLogs: "id, userId, type, loggedAt, [userId+type]",
        householdItems:
          "id, userId, kind, status, transactionId, [userId+status], [userId+transactionId]",
        budgets:
          "id, userId, categoryId, periodStart, [userId+periodStart], [userId+categoryId+periodStart]",
        outbox: "id, createdAt, table",
        syncMeta: "id",
      })
      .upgrade(async (tx) => {
        await tx
          .table("transactions")
          .toCollection()
          .modify((row: { source?: string }) => {
            if (!row.source) row.source = "manual";
          });
        await tx
          .table("householdItems")
          .toCollection()
          .modify((row: { dueDate?: string | null }) => {
            if (row.dueDate === undefined) row.dueDate = null;
          });
      });
  }
}

let dbInstance: AkosileDB | null = null;

export function getDb(): AkosileDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbInstance) {
    dbInstance = new AkosileDB();
  }
  return dbInstance;
}

/**
 * Open the database, recovering from an unusable local store.
 *
 * A schema or upgrade failure would otherwise leave the app stuck on its
 * loading state, so the corrupt database is dropped and recreated. Only
 * unsynced local data is lost; anything already pushed to Supabase returns on
 * the next pull.
 */
export async function openDb(): Promise<{ recovered: boolean }> {
  const db = getDb();
  try {
    await db.open();
    return { recovered: false };
  } catch {
    db.close();
    await Dexie.delete("akosile");
    dbInstance = null;
    await getDb().open();
    return { recovered: true };
  }
}
