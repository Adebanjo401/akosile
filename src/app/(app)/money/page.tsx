"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format, isSameMonth, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Plus, Settings2, Wallet } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useQuickAdd } from "@/lib/quick-add";
import { getDb } from "@/lib/db";
import { deleteTransaction, formatMoney, getAccountBalanceMinor } from "@/lib/data/money";
import { getCurrency } from "@/lib/money/currencies";
import type { CurrencyCode, Transaction } from "@/types";
import { Button } from "@/components/ui/button";
import { MoneyInsights } from "@/components/charts/MoneyInsights";
import { toast } from "sonner";

/** Convert a balance in its own currency into base-currency minor units. */
function toBase(
  minor: number,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode,
  rate: number,
): number {
  const major = minor / 10 ** getCurrency(currency).minorUnits;
  return Math.round(major * rate * 10 ** getCurrency(baseCurrency).minorUnits);
}

export default function MoneyPage() {
  const { userId, profile } = useApp();
  const quickAdd = useQuickAdd();

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

  const transactions = useLiveQuery(async () => {
    if (!userId) return [];
    const txs = await getDb().transactions.where({ userId }).toArray();
    return txs.sort((a, b) => b.date.localeCompare(a.date));
  }, [userId]);

  const categories = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().categories.where({ userId }).toArray();
  }, [userId]);

  const rates = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().exchangeRates.where({ userId }).toArray();
  }, [userId]);

  const household = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().householdItems.where({ userId }).toArray();
  }, [userId]);

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );
  const rateFor = useMemo(
    () => new Map((rates ?? []).map((r) => [r.currency, r])),
    [rates],
  );
  const linkedTxIds = useMemo(
    () =>
      new Set(
        (household ?? [])
          .map((item) => item.transactionId)
          .filter((id): id is string => Boolean(id)),
      ),
    [household],
  );

  const netWorthBase = useMemo(() => {
    if (!profile) return 0;
    return (accounts ?? []).reduce((sum, { account, balanceMinor }) => {
      if (account.currency === profile.baseCurrency) return sum + balanceMinor;
      const rate = rateFor.get(account.currency);
      if (!rate) return sum;
      return (
        sum +
        toBase(
          balanceMinor,
          account.currency,
          profile.baseCurrency,
          rate.rateToBase,
        )
      );
    }, 0);
  }, [accounts, profile, rateFor]);

  const month = useMemo(() => {
    const now = new Date();
    let spent = 0;
    let received = 0;
    for (const tx of transactions ?? []) {
      if (tx.status !== "cleared") continue;
      if (!isSameMonth(parseISO(tx.date), now)) continue;
      if (tx.type === "expense") spent += tx.amountBaseMinor;
      else received += tx.amountBaseMinor;
    }
    return { spent, received };
  }, [transactions]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of (transactions ?? []).slice(0, 60)) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return Array.from(map.entries());
  }, [transactions]);

  const oldestRate = rates?.length
    ? rates.reduce((a, b) => (a.asOf < b.asOf ? a : b))
    : null;

  if (!profile) return null;

  const locale = profile.locale;
  const base = profile.baseCurrency;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 md:px-8 md:py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="hidden md:block">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
            Money
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spending, insights and balances.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" onClick={() => quickAdd.open(["spent"])}>
            <ArrowUpRight />
            Add expense
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => quickAdd.open(["received"])}
          >
            <ArrowDownLeft />
            Money in
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="rounded-3xl bg-primary px-6 py-6 text-primary-foreground">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/70">
          Net position
        </p>
        <p className="mt-2 font-mono text-4xl tabular-nums">
          {formatMoney(netWorthBase, base, locale)}
        </p>
        <p className="mt-1 text-xs text-primary-foreground/70">
          {oldestRate
            ? `Rates last updated ${format(parseISO(oldestRate.asOf), "d MMM yyyy")}`
            : "All amounts in your base currency"}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-primary-foreground/70">
              <ArrowUpRight className="size-3.5" />
              Spent this month
            </p>
            <p className="mt-1 font-mono text-lg tabular-nums">
              {formatMoney(month.spent, base, locale)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-primary-foreground/70">
              <ArrowDownLeft className="size-3.5" />
              Received
            </p>
            <p className="mt-1 font-mono text-lg tabular-nums">
              {formatMoney(month.received, base, locale)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Insights</h2>
        <MoneyInsights
          transactions={transactions ?? []}
          categories={categories ?? []}
          base={base}
          locale={locale}
        />
      </section>

      {/* Accounts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Accounts</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/more#accounts">
              <Settings2 />
              Manage
            </Link>
          </Button>
        </div>

        {(accounts ?? []).length === 0 ? (
          <EmptyState
            title="No accounts yet"
            body="Add cash, bank or wallet accounts in Settings."
            action={
              <Button asChild variant="outline">
                <Link href="/more#accounts">
                  <Settings2 />
                  Add in Settings
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(accounts ?? []).map(({ account, balanceMinor }) => {
              const rate = rateFor.get(account.currency);
              const baseEq =
                account.currency === base
                  ? balanceMinor
                  : rate
                    ? toBase(
                        balanceMinor,
                        account.currency,
                        base,
                        rate.rateToBase,
                      )
                    : null;

              return (
                <div
                  key={account.id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Wallet className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {account.name}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {account.type.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 font-mono text-xl tabular-nums">
                    {formatMoney(balanceMinor, account.currency, locale)}
                  </p>
                  {account.currency !== base && (
                    <p className="text-xs text-muted-foreground">
                      {baseEq != null
                        ? `≈ ${formatMoney(baseEq, base, locale)}`
                        : "Set a rate to see the equivalent"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Exchange rates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Exchange rates
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/more#rates">
              <Settings2 />
              Manage
            </Link>
          </Button>
        </div>

        {(rates ?? []).length === 0 ? (
          <EmptyState
            title="No rates saved"
            body={`Add a rate in Settings when you hold money in a currency other than ${base}.`}
            action={
              <Button asChild variant="outline">
                <Link href="/more#rates">
                  <Settings2 />
                  Set in Settings
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {(rates ?? []).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium">
                  1 {r.currency} ={" "}
                  <span className="font-mono tabular-nums">
                    {r.rateToBase.toLocaleString(locale)}
                  </span>{" "}
                  {base}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(r.asOf), "d MMM")} · {r.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Transactions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Transactions</h2>

        {grouped.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            body="Use Add expense or Money in to log your first entry."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => quickAdd.open(["spent", "received"])}
              >
                <Plus />
                Add transaction
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            {grouped.map(([date, items]) => (
              <div key={date} className="space-y-2">
                <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {format(parseISO(date), "EEEE, d MMMM")}
                </p>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {items.map((tx) => {
                    const category = tx.categoryId
                      ? categoryById.get(tx.categoryId)
                      : null;
                    const income = tx.type === "income";
                    return (
                      <li
                        key={tx.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: category
                              ? `${category.color}1f`
                              : "var(--secondary)",
                            color: category
                              ? category.color
                              : "var(--muted-foreground)",
                          }}
                        >
                          {income ? (
                            <ArrowDownLeft className="size-4" />
                          ) : (
                            <ArrowUpRight className="size-4" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {category?.name ?? "Uncategorised"}
                          </p>
                          {tx.note && (
                            <p className="truncate text-xs text-muted-foreground">
                              {tx.note}
                            </p>
                          )}
                          {linkedTxIds.has(tx.id) && (
                            <p className="mt-0.5 text-[11px] font-medium text-primary">
                              Linked to Expense
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <p
                              className={`font-mono text-sm tabular-nums ${
                                income ? "text-success" : "text-foreground"
                              }`}
                            >
                              {income ? "+" : "−"}
                              {formatMoney(tx.amountMinor, tx.currency, locale)}
                            </p>
                            {tx.currency !== base && (
                              <p className="text-xs text-muted-foreground">
                                {formatMoney(tx.amountBaseMinor, base, locale)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:underline"
                            onClick={() =>
                              void deleteTransaction(userId, tx.id).then(() =>
                                toast.success("Transaction removed"),
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

