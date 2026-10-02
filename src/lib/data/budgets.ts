import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { getDb } from "@/lib/db";
import { enqueueDelete, enqueueUpsert, flushOutbox } from "@/lib/sync/engine";
import { createId, nowIso } from "@/lib/utils";
import type { Budget } from "@/types";

export function monthPeriodStart(date = new Date()): string {
  return format(startOfMonth(date), "yyyy-MM-dd");
}

export function previousPeriodStart(periodStart: string): string {
  return format(subMonths(parseISO(periodStart), 1), "yyyy-MM-01");
}

export function periodEndExclusive(periodStart: string): string {
  return format(startOfMonth(subMonths(parseISO(periodStart), -1)), "yyyy-MM-dd");
}

export class BudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetError";
  }
}

export async function listBudgetsForPeriod(
  userId: string,
  periodStart: string,
): Promise<Budget[]> {
  const db = getDb();
  return db.budgets.where("[userId+periodStart]").equals([userId, periodStart]).toArray();
}

/**
 * Ensure this month has budget rows. Copies last month's amounts when empty.
 */
export async function ensurePeriodBudgets(
  userId: string,
  periodStart: string,
): Promise<Budget[]> {
  const existing = await listBudgetsForPeriod(userId, periodStart);
  if (existing.length > 0) return existing;

  const prior = await listBudgetsForPeriod(userId, previousPeriodStart(periodStart));
  if (prior.length === 0) return [];

  const stamp = nowIso();
  const copies: Budget[] = prior.map((row) => ({
    id: createId(),
    userId,
    categoryId: row.categoryId,
    periodStart,
    amountBaseMinor: row.amountBaseMinor,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  const db = getDb();
  await db.budgets.bulkPut(copies);
  for (const budget of copies) {
    await enqueueUpsert("budgets", budget.id, budget, { flush: false });
  }
  void flushOutbox();
  return copies;
}

export async function upsertCategoryBudget(input: {
  userId: string;
  categoryId: string;
  periodStart: string;
  amountBaseMinor: number;
}): Promise<Budget> {
  if (input.amountBaseMinor < 0) {
    throw new BudgetError("Budget amount cannot be negative.");
  }
  const db = getDb();
  const existing = await db.budgets
    .where("[userId+categoryId+periodStart]")
    .equals([input.userId, input.categoryId, input.periodStart])
    .first();
  const stamp = nowIso();
  const budget: Budget = {
    id: existing?.id ?? createId(),
    userId: input.userId,
    categoryId: input.categoryId,
    periodStart: input.periodStart,
    amountBaseMinor: Math.round(input.amountBaseMinor),
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  await db.budgets.put(budget);
  await enqueueUpsert("budgets", budget.id, budget);
  return budget;
}

export async function deleteBudget(userId: string, id: string): Promise<void> {
  const db = getDb();
  const row = await db.budgets.get(id);
  if (!row || row.userId !== userId) return;
  await db.budgets.delete(id);
  await enqueueDelete("budgets", id);
}
