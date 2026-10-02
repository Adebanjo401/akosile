"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  Check,
  Link2,
  Plus,
  ShoppingBasket,
  Wrench,
} from "lucide-react";
import { isSameMonth, parseISO } from "date-fns";
import { useApp } from "@/lib/app-context";
import { getDb } from "@/lib/db";
import {
  completeHouseholdItem,
  createHouseholdItem,
  createItemFromTransaction,
  deleteHouseholdItem,
} from "@/lib/data/household";
import {
  ensurePeriodBudgets,
  monthPeriodStart,
  upsertCategoryBudget,
} from "@/lib/data/budgets";
import {
  ignoreMatch,
  linkItemToTransaction,
  listUnmatchedExpenses,
  scoreItemAgainstTransaction,
  unlinkItemFromTransaction,
} from "@/lib/data/matching";
import { formatMoney } from "@/lib/data/money";
import { fromMinorUnits, toMinorUnits } from "@/lib/money/currencies";
import { listCategories } from "@/lib/data/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  FormPanel,
  FormPanelBody,
  FormPanelContent,
  FormPanelDescription,
  FormPanelFooter,
  FormPanelHeader,
  FormPanelTitle,
} from "@/components/ui/form-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Budget,
  Category,
  HouseholdItem,
  HouseholdKind,
  Transaction,
} from "@/types";
import { cn } from "@/lib/utils";

const KIND_OPTIONS: { value: HouseholdKind; label: string }[] = [
  { value: "grocery", label: "Grocery" },
  { value: "repair", label: "Fix" },
  { value: "other", label: "Other" },
];

export default function ExpensePage() {
  const { userId, profile } = useApp();
  const [kindFilter, setKindFilter] = useState<"all" | HouseholdKind>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [completeItem, setCompleteItem] = useState<HouseholdItem | null>(null);
  const [matchItem, setMatchItem] = useState<HouseholdItem | null>(null);
  const [budgetCategory, setBudgetCategory] = useState<Category | null>(null);
  const [ignoreTick, setIgnoreTick] = useState(0);
  const periodStart = monthPeriodStart();

  useEffect(() => {
    if (!userId) return;
    void ensurePeriodBudgets(userId, periodStart);
  }, [userId, periodStart]);

  const items = useLiveQuery(async () => {
    if (!userId) return [];
    const all = await getDb().householdItems.where({ userId }).toArray();
    return all.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "needed" ? -1 : 1;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [userId]);

  const transactions = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().transactions.where({ userId }).toArray();
  }, [userId]);

  const categories = useLiveQuery(async () => {
    if (!userId) return [];
    return listCategories(userId, "money-expense");
  }, [userId]);

  const budgets = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb()
      .budgets.where("[userId+periodStart]")
      .equals([userId, periodStart])
      .toArray();
  }, [userId, periodStart]);

  const unmatched = useLiveQuery(async () => {
    if (!userId) return [];
    return listUnmatchedExpenses(userId, periodStart);
  }, [userId, periodStart, items, transactions, ignoreTick]);

  const visible = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (item.status === "cancelled") return false;
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      return true;
    });
  }, [items, kindFilter]);

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const summary = useMemo(() => {
    const now = new Date();
    let spent = 0;
    for (const tx of transactions ?? []) {
      if (tx.status !== "cleared" || tx.type !== "expense") continue;
      if (!isSameMonth(parseISO(tx.date), now)) continue;
      spent += tx.amountBaseMinor;
    }
    const budgeted = (budgets ?? []).reduce(
      (sum, b) => sum + b.amountBaseMinor,
      0,
    );
    let planned = 0;
    for (const item of items ?? []) {
      if (item.status !== "needed" || !item.estimatedAmountMinor) continue;
      planned += item.estimatedAmountMinor;
    }
    return { spent, budgeted, planned, remaining: budgeted - spent };
  }, [transactions, budgets, items]);

  const spentByCategory = useMemo(() => {
    const now = new Date();
    const map = new Map<string, number>();
    for (const tx of transactions ?? []) {
      if (tx.status !== "cleared" || tx.type !== "expense") continue;
      if (!isSameMonth(parseISO(tx.date), now)) continue;
      const key = tx.categoryId ?? "uncat";
      map.set(key, (map.get(key) ?? 0) + tx.amountBaseMinor);
    }
    return map;
  }, [transactions]);

  const budgetByCategory = useMemo(
    () => new Map((budgets ?? []).map((b) => [b.categoryId, b])),
    [budgets],
  );

  if (!profile) return null;

  const locale = profile.locale;
  const base = profile.baseCurrency;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="sr-only">Expense</h1>
        <Button type="button" className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus />
          Add item
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Budgeted"
          value={formatMoney(summary.budgeted, base, locale)}
        />
        <StatCard
          label="Spent"
          value={formatMoney(summary.spent, base, locale)}
        />
        <StatCard
          label="Remaining"
          value={formatMoney(summary.remaining, base, locale)}
          warn={summary.budgeted > 0 && summary.remaining < 0}
        />
        <StatCard
          label="Still planned"
          value={formatMoney(summary.planned, base, locale)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Budgets this month</h2>
        {(categories ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Money expense categories will appear here once they are seeded.
          </p>
        ) : (
          <ul className="space-y-2">
            {(categories ?? []).map((category) => {
              const budget = budgetByCategory.get(category.id);
              const spent = spentByCategory.get(category.id) ?? 0;
              const cap = budget?.amountBaseMinor ?? 0;
              const ratio = cap > 0 ? Math.min(1, spent / cap) : spent > 0 ? 1 : 0;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => setBudgetCategory(category)}
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="truncate font-medium">{category.name}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatMoney(spent, base, locale)}
                        {cap > 0 ? ` / ${formatMoney(cap, base, locale)}` : " · set cap"}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          cap > 0 && spent > cap ? "bg-destructive" : "bg-primary",
                        )}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(unmatched ?? []).length > 0 && (
        <MatchInbox
          userId={userId}
          periodStart={periodStart}
          unmatched={unmatched ?? []}
          items={(items ?? []).filter((i) => i.status === "needed" && !i.transactionId)}
          categoryById={categoryById}
          locale={locale}
          base={base}
          onIgnored={() => setIgnoreTick((n) => n + 1)}
        />
      )}

      <section className="space-y-3">
        <SegmentedControl
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: "all", label: "All" },
            { value: "grocery", label: "Groceries" },
            { value: "repair", label: "Fixes" },
            { value: "other", label: "Other" },
          ]}
        />

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
            <p className="text-sm font-medium">Nothing on the list</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add rice, soap, a leaking tap — then match the spend when it hits Money.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setAddOpen(true)}
            >
              <Plus />
              Add item
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {visible.map((item) => {
              const category = item.categoryId
                ? categoryById.get(item.categoryId)
                : null;
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {item.kind === "repair" ? (
                      <Wrench className="size-4" />
                    ) : (
                      <ShoppingBasket className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium ${
                        item.status === "done"
                          ? "text-muted-foreground line-through"
                          : ""
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.kind === "grocery"
                        ? "Grocery"
                        : item.kind === "repair"
                          ? "Fix"
                          : "Other"}
                      {category ? ` · ${category.name}` : ""}
                      {item.estimatedAmountMinor && item.currency
                        ? ` · est. ${formatMoney(item.estimatedAmountMinor, item.currency, locale)}`
                        : ""}
                      {item.transactionId ? " · matched to Money" : ""}
                    </p>
                  </div>
                  {item.status === "needed" ? (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Button
                        type="button"
                        size="xs"
                        onClick={() => setCompleteItem(item)}
                      >
                        <Check />
                        Paid
                      </Button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => setMatchItem(item)}
                      >
                        Match
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => void deleteHouseholdItem(userId, item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {item.transactionId && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() =>
                            void unlinkItemFromTransaction({
                              userId,
                              itemId: item.id,
                            }).then(() => toast.success("Unlinked from Money"))
                          }
                        >
                          Unlink
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => void deleteHouseholdItem(userId, item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        userId={userId}
        currency={base}
        categories={categories ?? []}
      />
      <CompleteItemDialog
        item={completeItem}
        onClose={() => setCompleteItem(null)}
        userId={userId}
        baseCurrency={base}
        categories={categories ?? []}
      />
      <MatchItemDialog
        item={matchItem}
        onClose={() => setMatchItem(null)}
        userId={userId}
        unmatched={unmatched ?? []}
        locale={locale}
      />
      <SetBudgetDialog
        category={budgetCategory}
        budget={
          budgetCategory
            ? budgetByCategory.get(budgetCategory.id) ?? null
            : null
        }
        onClose={() => setBudgetCategory(null)}
        userId={userId}
        periodStart={periodStart}
        currency={base}
        spent={
          budgetCategory
            ? spentByCategory.get(budgetCategory.id) ?? 0
            : 0
        }
        locale={locale}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-sm tabular-nums sm:text-base",
          warn && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MatchInbox({
  userId,
  periodStart,
  unmatched,
  items,
  categoryById,
  locale,
  base,
  onIgnored,
}: {
  userId: string;
  periodStart: string;
  unmatched: Transaction[];
  items: HouseholdItem[];
  categoryById: Map<string, Category>;
  locale: string;
  base: string;
  onIgnored: () => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Match to Money</h2>
      <p className="text-xs text-muted-foreground">
        Spends this month that are not linked to a planned item.
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {unmatched.map((tx) => {
          const ranked = items
            .map((item) => ({
              item,
              score: scoreItemAgainstTransaction(item, tx),
            }))
            .sort((a, b) => b.score - a.score);
          const suggestion = ranked[0];
          const category = tx.categoryId
            ? categoryById.get(tx.categoryId)
            : null;
          return (
            <li key={tx.id} className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {tx.note || category?.name || "Uncategorised spend"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.date}
                    {category ? ` · ${category.name}` : ""}
                    {suggestion && suggestion.score >= 40
                      ? ` · suggested: ${suggestion.item.title}`
                      : ""}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm tabular-nums">
                  {formatMoney(tx.amountBaseMinor, base, locale)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestion && suggestion.score >= 40 && (
                  <Button
                    type="button"
                    size="xs"
                    onClick={() =>
                      void linkItemToTransaction({
                        userId,
                        itemId: suggestion.item.id,
                        transactionId: tx.id,
                      }).then(() => toast.success(`Linked to ${suggestion.item.title}`))
                    }
                  >
                    <Link2 />
                    Link
                  </Button>
                )}
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    void createItemFromTransaction({
                      userId,
                      transactionId: tx.id,
                    }).then(() => toast.success("Added to the list"))
                  }
                >
                  <Plus />
                  New item
                </Button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => {
                    ignoreMatch(userId, periodStart, tx.id);
                    onIgnored();
                    toast.message("Hidden for this month");
                  }}
                >
                  Ignore
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  userId,
  currency,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currency: string;
  categories: Category[];
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<HouseholdKind>("grocery");
  const [estimate, setEstimate] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await createHouseholdItem({
        userId,
        title,
        kind,
        estimatedAmount: estimate ? Number(estimate) : undefined,
        currency: estimate ? currency : null,
        categoryId: categoryId || null,
        dueDate: dueDate || null,
      });
      toast.success("Added to Expense");
      setTitle("");
      setEstimate("");
      setDueDate("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }

  return (
    <FormPanel open={open} onOpenChange={onOpenChange}>
      <FormPanelContent>
        <FormPanelHeader>
          <FormPanelTitle>Add expense item</FormPanelTitle>
          <FormPanelDescription>
            Planned spend — groceries, a repair, or anything else.
          </FormPanelDescription>
        </FormPanelHeader>
        <FormPanelBody className="space-y-4">
          <Field label="What is it?" htmlFor="expense-title" error={error}>
            <Input
              id="expense-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 5kg rice, leaking tap"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Kind">
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as HouseholdKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due" htmlFor="expense-due" optional>
              <Input
                id="expense-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Category" optional>
            <Select
              value={categoryId || "none"}
              onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorised</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Estimated cost"
            htmlFor="expense-est"
            optional
            hint={`In ${currency}. You can log the real amount when it is paid.`}
          >
            <Input
              id="expense-est"
              inputMode="decimal"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="0"
            />
          </Field>
        </FormPanelBody>
        <FormPanelFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()}>
            Save item
          </Button>
        </FormPanelFooter>
      </FormPanelContent>
    </FormPanel>
  );
}

function CompleteItemDialog({
  item,
  onClose,
  userId,
  baseCurrency,
  categories,
}: {
  item: HouseholdItem | null;
  onClose: () => void;
  userId: string;
  baseCurrency: string;
  categories: Category[];
}) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [logExpense, setLogExpense] = useState(true);

  const accounts = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb()
      .accounts.where({ userId })
      .filter((a) => !a.archived)
      .toArray();
  }, [userId]);

  const defaultAmount =
    item?.estimatedAmountMinor && item.currency
      ? String(fromMinorUnits(item.estimatedAmountMinor, item.currency))
      : "";

  useEffect(() => {
    if (!item) return;
    setLogExpense(true);
    setAmount(defaultAmount);
    setCategoryId(item.categoryId ?? "");
  }, [item, defaultAmount]);

  async function submit() {
    if (!item) return;
    try {
      await completeHouseholdItem({
        userId,
        id: item.id,
        logExpense,
        accountId: accountId || accounts?.[0]?.id,
        amount: logExpense ? Number(amount || defaultAmount) : undefined,
        baseCurrency,
        categoryId: categoryId || item.categoryId,
      });
      toast.success(
        logExpense ? "Marked paid and logged in Money" : "Marked paid",
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete.");
    }
  }

  const estimate = item?.estimatedAmountMinor;
  const actualMinor =
    item?.currency && Number(amount) > 0
      ? toMinorUnits(Number(amount), item.currency)
      : null;
  const variance =
    estimate && actualMinor != null ? actualMinor - estimate : null;

  return (
    <FormPanel open={item != null} onOpenChange={(v) => !v && onClose()}>
      <FormPanelContent>
        <FormPanelHeader>
          <FormPanelTitle>Mark as paid</FormPanelTitle>
          <FormPanelDescription>
            {item?.title}. Logged to Money unless you turn that off.
          </FormPanelDescription>
        </FormPanelHeader>
        <FormPanelBody className="space-y-4">
          <label className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={logExpense}
              onChange={(e) => setLogExpense(e.target.checked)}
              className="size-4 accent-[var(--akosile-primary)]"
            />
            Log this as a spend in Money
          </label>
          {logExpense && (
            <div className="space-y-3">
              <Field label="Amount" htmlFor="expense-cost">
                <Input
                  id="expense-cost"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              {variance != null && variance !== 0 && item?.currency && (
                <p className="text-xs text-muted-foreground">
                  {variance > 0 ? "Over estimate by " : "Under estimate by "}
                  {formatMoney(Math.abs(variance), item.currency)}
                </p>
              )}
              <Field label="Account">
                <Select
                  value={accountId || accounts?.[0]?.id || ""}
                  onValueChange={setAccountId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose account" />
                  </SelectTrigger>
                  <SelectContent>
                    {(accounts ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category" optional>
                <Select
                  value={categoryId || "none"}
                  onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorised</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </FormPanelBody>
        <FormPanelFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()}>
            Paid
          </Button>
        </FormPanelFooter>
      </FormPanelContent>
    </FormPanel>
  );
}

function MatchItemDialog({
  item,
  onClose,
  userId,
  unmatched,
  locale,
}: {
  item: HouseholdItem | null;
  onClose: () => void;
  userId: string;
  unmatched: Transaction[];
  locale: string;
}) {
  const ranked = useMemo(() => {
    if (!item) return [];
    return unmatched
      .map((tx) => ({ tx, score: scoreItemAgainstTransaction(item, tx) }))
      .sort((a, b) => b.score - a.score);
  }, [item, unmatched]);

  return (
    <FormPanel open={item != null} onOpenChange={(v) => !v && onClose()}>
      <FormPanelContent>
        <FormPanelHeader>
          <FormPanelTitle>Match to a spend</FormPanelTitle>
          <FormPanelDescription>
            Link {item?.title} to a Money transaction from this month.
          </FormPanelDescription>
        </FormPanelHeader>
        <FormPanelBody>
          {ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No unmatched spends this month. Log one in Money, or use Paid.
            </p>
          ) : (
            <ul className="space-y-2">
              {ranked.map(({ tx, score }) => (
                <li key={tx.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-left hover:border-primary/40"
                    onClick={() =>
                      void linkItemToTransaction({
                        userId,
                        itemId: item!.id,
                        transactionId: tx.id,
                      }).then(() => {
                        toast.success("Matched to Money");
                        onClose();
                      })
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {tx.note || "Spend"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tx.date}
                        {score >= 40 ? " · likely match" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums">
                      {formatMoney(tx.amountMinor, tx.currency, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FormPanelBody>
        <FormPanelFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </FormPanelFooter>
      </FormPanelContent>
    </FormPanel>
  );
}

function SetBudgetDialog({
  category,
  budget,
  onClose,
  userId,
  periodStart,
  currency,
  spent,
  locale,
}: {
  category: Category | null;
  budget: Budget | null;
  onClose: () => void;
  userId: string;
  periodStart: string;
  currency: string;
  spent: number;
  locale: string;
}) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!category) return;
    setAmount(
      budget
        ? String(fromMinorUnits(budget.amountBaseMinor, currency))
        : "",
    );
  }, [category, budget, currency]);

  async function submit() {
    if (!category) return;
    const value = Number(amount);
    if (!(value >= 0) || Number.isNaN(value)) {
      toast.error("Enter a budget amount.");
      return;
    }
    await upsertCategoryBudget({
      userId,
      categoryId: category.id,
      periodStart,
      amountBaseMinor: toMinorUnits(value, currency),
    });
    toast.success(`Budget set for ${category.name}`);
    onClose();
  }

  return (
    <FormPanel open={category != null} onOpenChange={(v) => !v && onClose()}>
      <FormPanelContent>
        <FormPanelHeader>
          <FormPanelTitle>{category?.name} budget</FormPanelTitle>
          <FormPanelDescription>
            Monthly cap in {currency}. Spent so far:{" "}
            {formatMoney(spent, currency, locale)}.
          </FormPanelDescription>
        </FormPanelHeader>
        <FormPanelBody>
          <Field label="Amount" htmlFor="budget-amount">
            <Input
              id="budget-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
        </FormPanelBody>
        <FormPanelFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()}>
            Save budget
          </Button>
        </FormPanelFooter>
      </FormPanelContent>
    </FormPanel>
  );
}
