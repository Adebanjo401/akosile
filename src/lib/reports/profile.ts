import {
  endOfDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import type {
  Budget,
  Category,
  HealthLog,
  HouseholdItem,
  Task,
  Transaction,
} from "@/types";

export interface DateRange {
  from: Date;
  to: Date;
}

function inRange(dateIso: string, range: DateRange): boolean {
  const day = parseISO(dateIso.slice(0, 10));
  return isWithinInterval(day, {
    start: startOfDay(range.from),
    end: endOfDay(range.to),
  });
}

export function moneyTotals(transactions: Transaction[], range: DateRange) {
  let spent = 0;
  let received = 0;
  for (const tx of transactions) {
    if (tx.status !== "cleared" || !inRange(tx.date, range)) continue;
    if (tx.type === "expense") spent += tx.amountBaseMinor;
    else received += tx.amountBaseMinor;
  }
  return { spent, received };
}

export function spendByCategory(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange,
): { id: string; name: string; color: string; amountBaseMinor: number }[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.status !== "cleared" || tx.type !== "expense") continue;
    if (!inRange(tx.date, range)) continue;
    const key = tx.categoryId ?? "uncat";
    totals.set(key, (totals.get(key) ?? 0) + tx.amountBaseMinor);
  }
  const catById = new Map(categories.map((c) => [c.id, c]));
  return Array.from(totals.entries())
    .map(([id, amountBaseMinor]) => ({
      id,
      name: id === "uncat" ? "Uncategorised" : (catById.get(id)?.name ?? "Other"),
      color: id === "uncat" ? "#66736a" : (catById.get(id)?.color ?? "#14532d"),
      amountBaseMinor,
    }))
    .sort((a, b) => b.amountBaseMinor - a.amountBaseMinor);
}

export function budgetVsActual(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  periodStart: string,
) {
  const spent = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.status !== "cleared" || tx.type !== "expense") continue;
    if (tx.date.slice(0, 7) !== periodStart.slice(0, 7)) continue;
    const key = tx.categoryId ?? "uncat";
    spent.set(key, (spent.get(key) ?? 0) + tx.amountBaseMinor);
  }
  const catById = new Map(categories.map((c) => [c.id, c]));
  return budgets
    .filter((b) => b.periodStart === periodStart)
    .map((b) => ({
      categoryId: b.categoryId,
      name: catById.get(b.categoryId)?.name ?? "Category",
      color: catById.get(b.categoryId)?.color ?? "#14532d",
      budgeted: b.amountBaseMinor,
      spent: spent.get(b.categoryId) ?? 0,
    }));
}

export function expenseReport(items: HouseholdItem[], unmatchedCount: number) {
  let planned = 0;
  let paid = 0;
  let open = 0;
  let done = 0;
  const byKind = {
    grocery: 0,
    repair: 0,
    other: 0,
  };
  for (const item of items) {
    if (item.status === "cancelled") continue;
    byKind[item.kind] += 1;
    if (item.status === "needed") {
      open += 1;
      planned += item.estimatedAmountMinor ?? 0;
    }
    if (item.status === "done") {
      done += 1;
      paid += item.estimatedAmountMinor ?? 0;
    }
  }
  return { planned, paid, open, done, unmatchedCount, byKind };
}

export function scheduleReport(tasks: Task[], range: DateRange) {
  let open = 0;
  let completed = 0;
  let overdue = 0;
  const now = new Date();
  for (const task of tasks) {
    if (task.status === "cancelled") continue;
    if (task.status === "completed") {
      if (task.completedAt && inRange(task.completedAt, range)) completed += 1;
      continue;
    }
    open += 1;
    if (task.dueAt && parseISO(task.dueAt) < now) overdue += 1;
  }
  const considered = completed + open;
  const completionRate = considered === 0 ? 0 : completed / (completed + open);
  return { open, completed, overdue, completionRate };
}

export function healthReport(logs: HealthLog[], range: DateRange) {
  let water = 0;
  let sleepHours = 0;
  let sleepNights = 0;
  let workoutMinutes = 0;
  let meals = 0;
  for (const log of logs) {
    if (!inRange(log.loggedAt, range)) continue;
    if (log.type === "water") water += Number(log.value);
    if (log.type === "sleep") {
      sleepHours += Number(log.value);
      sleepNights += 1;
    }
    if (log.type === "workout" || log.type === "exercise") {
      workoutMinutes += Number(log.value);
    }
    if (log.type === "food") meals += 1;
  }
  return {
    water,
    avgSleep: sleepNights ? sleepHours / sleepNights : 0,
    workoutMinutes,
    meals,
  };
}

export function rangeLabel(range: DateRange, locale?: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${range.from.toLocaleDateString(locale, opts)} – ${range.to.toLocaleDateString(locale, opts)}`;
}
