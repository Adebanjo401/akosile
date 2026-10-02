"use client";

import { useMemo } from "react";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  isSameMonth,
  parseISO,
  subDays,
} from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/data/money";
import { getCurrency } from "@/lib/money/currencies";
import type { Category, CurrencyCode, Transaction } from "@/types";

const SPENT_FILL = "#14532d";
const RECEIVED_FILL = "#c89b3c";

export function MoneyInsights({
  transactions,
  categories,
  base,
  locale,
  from,
  to,
}: {
  transactions: Transaction[];
  categories: Category[];
  base: CurrencyCode;
  locale: string;
  from?: Date;
  to?: Date;
}) {
  const divisor = 10 ** getCurrency(base).minorUnits;
  const rangeEnd = to ?? new Date();
  const rangeStart = from ?? subDays(rangeEnd, 6);

  const week = useMemo(() => {
    const days = differenceInCalendarDays(rangeEnd, rangeStart);
    if (days > 21) {
      const weeks = eachWeekOfInterval(
        { start: rangeStart, end: rangeEnd },
        { weekStartsOn: 1 },
      );
      return weeks.map((start, index) => {
        const end =
          index + 1 < weeks.length
            ? weeks[index + 1]
            : rangeEnd;
        let spent = 0;
        let received = 0;
        for (const tx of transactions) {
          if (tx.status !== "cleared") continue;
          const d = parseISO(tx.date);
          if (d < start || d >= end) continue;
          if (tx.type === "expense") spent += tx.amountBaseMinor;
          else received += tx.amountBaseMinor;
        }
        return {
          label: format(start, "d MMM"),
          spent: spent / divisor,
          received: received / divisor,
        };
      });
    }
    const daysIn = eachDayOfInterval({
      start: rangeStart,
      end: rangeEnd,
    });
    return daysIn.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      let spent = 0;
      let received = 0;
      for (const tx of transactions) {
        if (tx.status !== "cleared" || tx.date !== key) continue;
        if (tx.type === "expense") spent += tx.amountBaseMinor;
        else received += tx.amountBaseMinor;
      }
      return {
        label: format(day, "EEE"),
        spent: spent / divisor,
        received: received / divisor,
      };
    });
  }, [transactions, divisor, rangeStart, rangeEnd]);

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    const startKey = format(rangeStart, "yyyy-MM-dd");
    const endKey = format(rangeEnd, "yyyy-MM-dd");
    for (const tx of transactions) {
      if (tx.status !== "cleared" || tx.type !== "expense") continue;
      if (from || to) {
        if (tx.date < startKey || tx.date > endKey) continue;
      } else if (!isSameMonth(parseISO(tx.date), rangeEnd)) {
        continue;
      }
      const key = tx.categoryId ?? "uncat";
      totals.set(key, (totals.get(key) ?? 0) + tx.amountBaseMinor);
    }
    const catById = new Map(categories.map((c) => [c.id, c]));
    return Array.from(totals.entries())
      .map(([id, minor]) => ({
        name: id === "uncat" ? "Uncategorised" : (catById.get(id)?.name ?? "Other"),
        value: minor / divisor,
        color: id === "uncat" ? "#66736a" : (catById.get(id)?.color ?? "#14532d"),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions, categories, divisor, rangeStart, rangeEnd, from, to]);

  const weekHasData = week.some((d) => d.spent > 0 || d.received > 0);

  if (!weekHasData && byCategory.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-center">
        <p className="text-sm font-medium">No insight yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Charts fill in as you log spending and money in.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {weekHasData && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">
            {from || to ? "Spending over the period" : "Last 7 days"}
          </p>
          <p className="text-xs text-muted-foreground">
            Amounts in {base}, major units
          </p>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} barGap={2}>
                <CartesianGrid stroke="#dde5df" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#66736a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#66736a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatMoney(
                      Math.round(Number(value) * divisor),
                      base,
                      locale,
                    ),
                    name === "spent" ? "Spent" : "Received",
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #dde5df",
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="spent"
                  name="spent"
                  fill={SPENT_FILL}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="received"
                  name="received"
                  fill={RECEIVED_FILL}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {byCategory.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">
            {from || to ? "By category" : "This month by category"}
          </p>
          <p className="text-xs text-muted-foreground">Share of spending</p>
          <div className="mt-3 flex h-48 items-center gap-4">
            <div className="h-full min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {byCategory.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      formatMoney(
                        Math.round(Number(value) * divisor),
                        base,
                        locale,
                      )
                    }
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #dde5df",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-36 shrink-0 space-y-1.5">
              {byCategory.map((slice) => (
                <li
                  key={slice.name}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate">{slice.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
