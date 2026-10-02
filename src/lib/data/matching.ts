import { differenceInCalendarDays, parseISO } from "date-fns";
import { getDb } from "@/lib/db";
import { enqueueUpsert } from "@/lib/sync/engine";
import { nowIso } from "@/lib/utils";
import { monthPeriodStart, periodEndExclusive } from "@/lib/data/budgets";
import type { HouseholdItem, Transaction } from "@/types";

export const MATCH_SCORE_THRESHOLD = 40;

function ignoreKey(userId: string, periodStart: string): string {
  return `akosile.matchIgnore.${userId}.${periodStart}`;
}

export function listIgnoredMatchIds(
  userId: string,
  periodStart: string,
): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ignoreKey(userId, periodStart));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function ignoreMatch(userId: string, periodStart: string, transactionId: string): void {
  if (typeof window === "undefined") return;
  const next = new Set(listIgnoredMatchIds(userId, periodStart));
  next.add(transactionId);
  localStorage.setItem(ignoreKey(userId, periodStart), JSON.stringify([...next]));
}

function tokens(value: string | null | undefined): string[] {
  return (value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

export function scoreItemAgainstTransaction(
  item: HouseholdItem,
  tx: Transaction,
): number {
  let score = 0;

  if (item.categoryId && tx.categoryId && item.categoryId === tx.categoryId) {
    score += 40;
  }

  if (
    item.estimatedAmountMinor != null &&
    item.estimatedAmountMinor > 0 &&
    tx.amountMinor > 0
  ) {
    const delta =
      Math.abs(item.estimatedAmountMinor - tx.amountMinor) / tx.amountMinor;
    if (delta <= 0.2) score += 30;
    else if (delta <= 0.4) score += 15;
  }

  const itemDate = item.dueDate || item.createdAt.slice(0, 10);
  const days = Math.abs(
    differenceInCalendarDays(parseISO(tx.date), parseISO(itemDate)),
  );
  if (days <= 7) score += 20;
  else if (days <= 14) score += 8;

  const itemTokens = new Set(tokens(item.title).concat(tokens(item.note)));
  const txTokens = tokens(tx.note);
  let overlap = 0;
  for (const token of txTokens) {
    if (itemTokens.has(token)) overlap += 1;
  }
  score += Math.min(30, overlap * 10);

  return score;
}

export interface MatchSuggestion {
  transaction: Transaction;
  item: HouseholdItem;
  score: number;
}

export function bestItemForTransaction(
  items: HouseholdItem[],
  tx: Transaction,
): MatchSuggestion | null {
  let best: MatchSuggestion | null = null;
  for (const item of items) {
    if (item.status === "cancelled") continue;
    if (item.transactionId) continue;
    const score = scoreItemAgainstTransaction(item, tx);
    if (!best || score > best.score) {
      best = { transaction: tx, item, score };
    }
  }
  if (!best || best.score < MATCH_SCORE_THRESHOLD) return null;
  return best;
}

export async function listUnmatchedExpenses(
  userId: string,
  periodStart: string,
): Promise<Transaction[]> {
  const db = getDb();
  const end = periodEndExclusive(periodStart);
  const txs = await db.transactions.where({ userId }).toArray();
  const items = await db.householdItems.where({ userId }).toArray();
  const linked = new Set(
    items.map((i) => i.transactionId).filter((id): id is string => Boolean(id)),
  );
  const ignored = new Set(listIgnoredMatchIds(userId, periodStart));
  return txs.filter(
    (tx) =>
      tx.type === "expense" &&
      tx.status === "cleared" &&
      tx.date >= periodStart &&
      tx.date < end &&
      !linked.has(tx.id) &&
      !ignored.has(tx.id),
  );
}

export async function listOpenItems(userId: string): Promise<HouseholdItem[]> {
  const db = getDb();
  const items = await db.householdItems.where({ userId }).toArray();
  return items.filter((i) => i.status === "needed" && !i.transactionId);
}

export async function suggestMatchesForPeriod(
  userId: string,
  periodStart = monthPeriodStart(),
): Promise<MatchSuggestion[]> {
  const unmatched = await listUnmatchedExpenses(userId, periodStart);
  const open = await listOpenItems(userId);
  const suggestions: MatchSuggestion[] = [];
  const usedItems = new Set<string>();
  for (const tx of unmatched) {
    const best = bestItemForTransaction(
      open.filter((i) => !usedItems.has(i.id)),
      tx,
    );
    if (!best) continue;
    usedItems.add(best.item.id);
    suggestions.push(best);
  }
  return suggestions.sort((a, b) => b.score - a.score);
}

export async function linkItemToTransaction(input: {
  userId: string;
  itemId: string;
  transactionId: string;
  markDone?: boolean;
}): Promise<HouseholdItem | null> {
  const db = getDb();
  const item = await db.householdItems.get(input.itemId);
  const tx = await db.transactions.get(input.transactionId);
  if (!item || item.userId !== input.userId) return null;
  if (!tx || tx.userId !== input.userId) return null;

  const clash = await db.householdItems
    .where("[userId+transactionId]")
    .equals([input.userId, input.transactionId])
    .first();
  if (clash && clash.id !== item.id) {
    const cleared: HouseholdItem = {
      ...clash,
      transactionId: null,
      updatedAt: nowIso(),
    };
    await db.householdItems.put(cleared);
    await enqueueUpsert("householdItems", cleared.id, cleared, { flush: false });
  }

  const stamp = nowIso();
  const markDone = input.markDone !== false;
  const updated: HouseholdItem = {
    ...item,
    transactionId: tx.id,
    status: markDone ? "done" : item.status,
    completedAt: markDone ? stamp : item.completedAt,
    categoryId: item.categoryId ?? tx.categoryId ?? null,
    updatedAt: stamp,
  };
  await db.householdItems.put(updated);
  await enqueueUpsert("householdItems", updated.id, updated);
  return updated;
}

export async function unlinkItemFromTransaction(input: {
  userId: string;
  itemId: string;
  restoreNeeded?: boolean;
}): Promise<HouseholdItem | null> {
  const db = getDb();
  const item = await db.householdItems.get(input.itemId);
  if (!item || item.userId !== input.userId) return null;
  const stamp = nowIso();
  const restore = input.restoreNeeded !== false;
  const updated: HouseholdItem = {
    ...item,
    transactionId: null,
    status: restore ? "needed" : item.status,
    completedAt: restore ? null : item.completedAt,
    updatedAt: stamp,
  };
  await db.householdItems.put(updated);
  await enqueueUpsert("householdItems", updated.id, updated);
  return updated;
}

export async function findItemForTransaction(
  userId: string,
  transactionId: string,
): Promise<HouseholdItem | null> {
  const db = getDb();
  return (
    (await db.householdItems
      .where("[userId+transactionId]")
      .equals([userId, transactionId])
      .first()) ?? null
  );
}
