import { getDb } from "@/lib/db";
import { createTransaction } from "@/lib/data/money";
import { enqueueDelete, enqueueUpsert } from "@/lib/sync/engine";
import { toMinorUnits } from "@/lib/money/currencies";
import { createId, nowIso } from "@/lib/utils";
import type {
  CurrencyCode,
  HouseholdItem,
  HouseholdKind,
} from "@/types";

export class HouseholdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HouseholdError";
  }
}

export async function createHouseholdItem(input: {
  userId: string;
  title: string;
  kind: HouseholdKind;
  estimatedAmount?: number;
  currency?: CurrencyCode | null;
  categoryId?: string | null;
  note?: string | null;
  dueDate?: string | null;
}): Promise<HouseholdItem> {
  const title = input.title.trim();
  if (!title) {
    throw new HouseholdError("Enter what you need to buy or fix.");
  }

  const stamp = nowIso();
  const item: HouseholdItem = {
    id: createId(),
    userId: input.userId,
    title,
    kind: input.kind,
    status: "needed",
    estimatedAmountMinor:
      input.estimatedAmount && input.estimatedAmount > 0 && input.currency
        ? toMinorUnits(input.estimatedAmount, input.currency)
        : null,
    currency: input.currency ?? null,
    categoryId: input.categoryId ?? null,
    note: input.note?.trim() || null,
    transactionId: null,
    dueDate: input.dueDate || null,
    completedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const db = getDb();
  await db.householdItems.put(item);
  await enqueueUpsert("householdItems", item.id, item);
  return item;
}

export async function updateHouseholdItem(
  userId: string,
  id: string,
  patch: Partial<
    Pick<HouseholdItem, "title" | "kind" | "categoryId" | "note" | "dueDate">
  >,
): Promise<HouseholdItem | null> {
  const db = getDb();
  const item = await db.householdItems.get(id);
  if (!item || item.userId !== userId) return null;
  const updated: HouseholdItem = {
    ...item,
    ...patch,
    updatedAt: nowIso(),
  };
  await db.householdItems.put(updated);
  await enqueueUpsert("householdItems", updated.id, updated);
  return updated;
}

export async function completeHouseholdItem(input: {
  userId: string;
  id: string;
  logExpense?: boolean;
  accountId?: string;
  amount?: number;
  baseCurrency?: CurrencyCode;
  categoryId?: string | null;
  date?: string;
}): Promise<HouseholdItem | null> {
  const db = getDb();
  const item = await db.householdItems.get(input.id);
  if (!item || item.userId !== input.userId) return null;

  const logExpense = input.logExpense !== false;
  let transactionId = item.transactionId;

  if (logExpense) {
    if (!input.accountId || !input.baseCurrency) {
      throw new HouseholdError("Choose an account to log this as an expense.");
    }
    const amount = input.amount ?? 0;
    if (!(amount > 0)) {
      throw new HouseholdError("Enter what it actually cost.");
    }
    const account = await db.accounts.get(input.accountId);
    if (!account) {
      throw new HouseholdError("Choose a valid account.");
    }
    const categoryId = input.categoryId ?? item.categoryId;
    const tx = await createTransaction({
      userId: input.userId,
      type: "expense",
      accountId: input.accountId,
      amount,
      currency: account.currency,
      baseCurrency: input.baseCurrency,
      categoryId,
      note: item.title,
      date: input.date,
      source: "expense",
    });
    transactionId = tx.id;
  }

  const stamp = nowIso();
  const updated: HouseholdItem = {
    ...item,
    status: "done",
    transactionId,
    categoryId: input.categoryId ?? item.categoryId,
    completedAt: stamp,
    updatedAt: stamp,
  };
  await db.householdItems.put(updated);
  await enqueueUpsert("householdItems", updated.id, updated);
  return updated;
}

export async function createItemFromTransaction(input: {
  userId: string;
  transactionId: string;
  kind?: HouseholdKind;
}): Promise<HouseholdItem | null> {
  const db = getDb();
  const tx = await db.transactions.get(input.transactionId);
  if (!tx || tx.userId !== input.userId) return null;

  const existing = await db.householdItems
    .where("[userId+transactionId]")
    .equals([input.userId, tx.id])
    .first();
  if (existing) return existing;

  const stamp = nowIso();
  const item: HouseholdItem = {
    id: createId(),
    userId: input.userId,
    title: tx.note?.trim() || "Logged spend",
    kind: input.kind ?? "other",
    status: "done",
    estimatedAmountMinor: tx.amountMinor,
    currency: tx.currency,
    categoryId: tx.categoryId ?? null,
    note: null,
    transactionId: tx.id,
    dueDate: tx.date,
    completedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.householdItems.put(item);
  await enqueueUpsert("householdItems", item.id, item);
  return item;
}

export async function deleteHouseholdItem(
  userId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  const item = await db.householdItems.get(id);
  if (!item || item.userId !== userId) return;
  await db.householdItems.delete(id);
  await enqueueDelete("householdItems", id);
}
