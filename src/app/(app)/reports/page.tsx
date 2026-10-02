"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  endOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useApp } from "@/lib/app-context";
import { getDb } from "@/lib/db";
import { formatMoney, getAccountBalanceMinor } from "@/lib/data/money";
import { getCurrency } from "@/lib/money/currencies";
import { listUnmatchedExpenses } from "@/lib/data/matching";
import { monthPeriodStart } from "@/lib/data/budgets";
import {
  budgetVsActual,
  expenseReport,
  healthReport,
  moneyTotals,
  rangeLabel,
  scheduleReport,
  spendByCategory,
  type DateRange,
} from "@/lib/reports/profile";
import { MoneyInsights } from "@/components/charts/MoneyInsights";
import { HealthInsights } from "@/components/charts/HealthInsights";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import type { CurrencyCode } from "@/types";

type PeriodKey = "week" | "month" | "quarter";

function rangeFor(period: PeriodKey, firstDayOfWeek: 0 | 1): DateRange {
  const to = endOfDay(new Date());
  if (period === "week") {
    return {
      from: startOfWeek(new Date(), {
        weekStartsOn: firstDayOfWeek,
      }),
      to,
    };
  }
  if (period === "month") {
    return { from: startOfMonth(new Date()), to };
  }
  return { from: startOfMonth(subMonths(new Date(), 2)), to };
}

function toBase(
  minor: number,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode,
  rate: number,
): number {
  const major = minor / 10 ** getCurrency(currency).minorUnits;
  return Math.round(major * rate * 10 ** getCurrency(baseCurrency).minorUnits);
}

export default function ReportsPage() {
  const { userId, profile } = useApp();
  const [period, setPeriod] = useState<PeriodKey>("month");

  const range = useMemo(
    () => rangeFor(period, profile?.firstDayOfWeek ?? 1),
    [period, profile?.firstDayOfWeek],
  );
  const periodStart = monthPeriodStart();

  const transactions = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().transactions.where({ userId }).toArray();
  }, [userId]);

  const categories = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().categories.where({ userId }).toArray();
  }, [userId]);

  const accounts = useLiveQuery(async () => {
    if (!userId) return [];
    const list = await getDb()
      .accounts.where({ userId })
      .filter((a) => !a.archived)
      .toArray();
    return Promise.all(
      list.map(async (account) => ({
        account,
        balanceMinor: await getAccountBalanceMinor(account),
      })),
    );
  }, [userId]);

  const rates = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().exchangeRates.where({ userId }).toArray();
  }, [userId]);

  const budgets = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().budgets.where({ userId }).toArray();
  }, [userId]);

  const items = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().householdItems.where({ userId }).toArray();
  }, [userId]);

  const tasks = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().tasks.where({ userId }).toArray();
  }, [userId]);

  const healthLogs = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().healthLogs.where({ userId }).toArray();
  }, [userId]);

  const unmatched = useLiveQuery(async () => {
    if (!userId) return [];
    return listUnmatchedExpenses(userId, periodStart);
  }, [userId, periodStart, items, transactions]);

  const rateFor = useMemo(
    () => new Map((rates ?? []).map((r) => [r.currency, r])),
    [rates],
  );

  if (!profile) return null;

  const locale = profile.locale;
  const base = profile.baseCurrency;
  const modules = profile.modules;
  const money = moneyTotals(transactions ?? [], range);
  const expense = expenseReport(items ?? [], unmatched?.length ?? 0);
  const schedule = scheduleReport(tasks ?? [], range);
  const health = healthReport(healthLogs ?? [], range);
  const vsBudget = budgetVsActual(
    budgets ?? [],
    transactions ?? [],
    categories ?? [],
    periodStart,
  );
  const topCats = spendByCategory(transactions ?? [], categories ?? [], range).slice(0, 6);

  const netWorth = (accounts ?? []).reduce((sum, { account, balanceMinor }) => {
    if (account.currency === base) return sum + balanceMinor;
    const rate = rateFor.get(account.currency);
    if (!rate) return sum;
    return sum + toBase(balanceMinor, account.currency, base, rate.rateToBase);
  }, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-4">
        <div className="hidden md:block">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.name}&apos;s picture across money, expenses, schedule and health.
          </p>
        </div>
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          options={[
            { value: "week", label: "This week" },
            { value: "month", label: "This month" },
            { value: "quarter", label: "Last 3 months" },
          ]}
        />
        <p className="text-xs text-muted-foreground">{rangeLabel(range, locale)}</p>
      </header>

      {modules.money !== false && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Money</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Net position" value={formatMoney(netWorth, base, locale)} />
            <Stat label="Spent" value={formatMoney(money.spent, base, locale)} />
            <Stat label="Received" value={formatMoney(money.received, base, locale)} />
          </div>
          <MoneyInsights
            transactions={transactions ?? []}
            categories={categories ?? []}
            base={base}
            locale={locale}
            from={range.from}
            to={range.to}
          />
          {vsBudget.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Budget vs actual (this month)</p>
              <ul className="mt-3 space-y-2">
                {vsBudget.map((row) => {
                  const ratio =
                    row.budgeted > 0
                      ? Math.min(1, row.spent / row.budgeted)
                      : row.spent > 0
                        ? 1
                        : 0;
                  return (
                    <li key={row.categoryId}>
                      <div className="flex items-center justify-between text-xs">
                        <span>{row.name}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatMoney(row.spent, base, locale)} /{" "}
                          {formatMoney(row.budgeted, base, locale)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {topCats.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Top category: {topCats[0].name} (
              {formatMoney(topCats[0].amountBaseMinor, base, locale)})
            </p>
          )}
        </section>
      )}

      {modules.household !== false && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Expense</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/expense">Open Expense</Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Open" value={String(expense.open)} />
            <Stat label="Paid" value={String(expense.done)} />
            <Stat
              label="Planned"
              value={formatMoney(expense.planned, base, locale)}
            />
            <Stat label="Unmatched" value={String(expense.unmatchedCount)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Groceries {expense.byKind.grocery} · Fixes {expense.byKind.repair} · Other{" "}
            {expense.byKind.other}
          </p>
        </section>
      )}

      {modules.schedule !== false && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Schedule</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Open" value={String(schedule.open)} />
            <Stat label="Done in period" value={String(schedule.completed)} />
            <Stat label="Overdue" value={String(schedule.overdue)} />
            <Stat
              label="Completion"
              value={`${Math.round(schedule.completionRate * 100)}%`}
            />
          </div>
        </section>
      )}

      {modules.health !== false && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Health</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Water"
              value={`${health.water} ${profile.waterUnit === "ml" ? "ml" : "cups"}`}
            />
            <Stat
              label="Avg sleep"
              value={health.avgSleep ? `${health.avgSleep.toFixed(1)} h` : "—"}
            />
            <Stat label="Workout" value={`${health.workoutMinutes} min`} />
            <Stat label="Meals logged" value={String(health.meals)} />
          </div>
          <HealthInsights logs={healthLogs ?? []} from={range.from} to={range.to} />
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm tabular-nums sm:text-base">{value}</p>
    </div>
  );
}
