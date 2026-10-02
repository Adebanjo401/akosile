"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Check, Droplets, Moon, Plus, Wallet } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { listCategories, createCategory } from "@/lib/data/categories";
import { createTask } from "@/lib/data/tasks";
import {
  createTransaction,
  getRateToBase,
  saveManualRate,
} from "@/lib/data/money";
import {
  bestItemForTransaction,
  linkItemToTransaction,
  listOpenItems,
} from "@/lib/data/matching";
import { addHealthLog } from "@/lib/data/health";
import { getDb } from "@/lib/db";
import { getCurrency } from "@/lib/money/currencies";
import { cn } from "@/lib/utils";
import type { Category, CategoryModule, RecurrenceFrequency } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
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
import { SegmentedControl } from "@/components/SegmentedControl";

export type QuickAddTab = "task" | "spent" | "received" | "health";

const TAB_LABELS: Record<QuickAddTab, string> = {
  task: "Task",
  spent: "Spent",
  received: "Received",
  health: "Health",
};

/** Heading copy per scope, so the sheet names the job it was opened for. */
function headingFor(tabs: QuickAddTab[]): {
  title: string;
  description: string;
} {
  if (tabs.length === 1) {
    switch (tabs[0]) {
      case "task":
        return { title: "New task", description: "What needs doing, and when." };
      case "spent":
        return { title: "New expense", description: "Money leaving an account." };
      case "received":
        return { title: "Money in", description: "Money arriving in an account." };
      case "health":
        return { title: "Log health", description: "Water and sleep for today." };
    }
  }
  if (tabs.every((t) => t === "spent" || t === "received")) {
    return { title: "New transaction", description: "Log money in or out." };
  }
  return { title: "Quick add", description: "Capture it now, refine it later." };
}

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

function todayInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface QuickAddSheetProps {
  /** Tabs the sheet is scoped to, or `null` when closed. */
  tabs: QuickAddTab[] | null;
  onClose: () => void;
}

export function QuickAddSheet({ tabs, onClose }: QuickAddSheetProps) {
  const { userId, profile } = useApp();
  const [tab, setTab] = useState<QuickAddTab>("task");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [time, setTime] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [currency, setCurrency] = useState(profile?.baseCurrency ?? "NGN");
  const [rateInput, setRateInput] = useState("");
  const [needsRate, setNeedsRate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("none");
  const [healthType, setHealthType] = useState<"water" | "sleep">("water");
  const [sleepHours, setSleepHours] = useState("7.5");
  const [categorySearch, setCategorySearch] = useState("");

  const open = tabs !== null;
  const scope = useMemo<QuickAddTab[]>(
    () => tabs ?? ["task", "spent", "received", "health"],
    [tabs],
  );
  const heading = useMemo(() => headingFor(scope), [scope]);
  /** Stay inside the tabs this sheet was opened with — avoids flashing the wrong form. */
  const activeTab = scope.includes(tab) ? tab : scope[0];

  const accounts = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb()
      .accounts.where({ userId })
      .filter((a) => !a.archived)
      .toArray();
  }, [userId]);

  const moduleForTab: CategoryModule | null =
    activeTab === "task"
      ? "task"
      : activeTab === "spent"
        ? "money-expense"
        : activeTab === "received"
          ? "money-income"
          : null;

  const categories = useLiveQuery(async () => {
    if (!userId || !moduleForTab) return [];
    return listCategories(userId, moduleForTab);
  }, [userId, moduleForTab]);

  useEffect(() => {
    if (!open) return;
    setTab(scope[0]);
    setError(null);
    setDate(todayInputValue());
  }, [open, scope]);

  useEffect(() => {
    if (accounts?.length && !accountId) {
      setAccountId(accounts[0].id);
      setCurrency(accounts[0].currency);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    const selected = accounts?.find((a) => a.id === accountId);
    if (selected) setCurrency(selected.currency);
  }, [accountId, accounts]);

  useEffect(() => {
    async function checkRate() {
      if (!profile || !userId) return;
      if (currency === profile.baseCurrency) {
        setNeedsRate(false);
        return;
      }
      const rate = await getRateToBase(userId, currency, profile.baseCurrency);
      setNeedsRate(!rate);
      setRateInput(rate ? String(rate.rateToBase) : "");
    }
    void checkRate();
  }, [currency, profile, userId]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!categories) return [];
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const isMoney = activeTab === "spent" || activeTab === "received";
  const baseCurrency = profile?.baseCurrency ?? "NGN";
  /** Money entries need somewhere to land; `undefined` means still loading. */
  const hasNoAccounts = accounts != null && accounts.length === 0;

  function resetForm() {
    setTitle("");
    setAmount("");
    setNote("");
    setTime("");
    setCategorySearch("");
    setCategoryId(null);
    setRecurrence("none");
  }

  function buildDueAt(): string {
    const stamp = time ? `${date}T${time}` : `${date}T09:00`;
    const parsed = new Date(stamp);
    return Number.isNaN(parsed.getTime())
      ? new Date().toISOString()
      : parsed.toISOString();
  }

  async function handleSave() {
    if (!profile) return;
    setError(null);
    setSaving(true);
    try {
      if (activeTab === "task") {
        if (!title.trim()) throw new Error("Enter a title to save this task.");
        await createTask({
          userId,
          title,
          categoryId,
          dueAt: buildDueAt(),
          recurrence: { frequency: recurrence, interval: 1 },
          notes: note || null,
        });
      } else if (isMoney) {
        if (!accountId) {
          throw new Error("Add an account on the Money page first.");
        }
        const value = Number(amount);
        if (!(value > 0)) throw new Error("Enter an amount greater than 0.");

        let rateToBase: number | undefined;
        if (currency !== profile.baseCurrency) {
          const rate = Number(rateInput);
          if (!(rate > 0)) {
            throw new Error(
              `Enter an exchange rate for ${currency} to save this entry.`,
            );
          }
          await saveManualRate({ userId, currency, rateToBase: rate });
          rateToBase = rate;
        }

        const tx = await createTransaction({
          userId,
          type: activeTab === "spent" ? "expense" : "income",
          accountId,
          amount: value,
          currency,
          baseCurrency: profile.baseCurrency,
          rateToBase,
          categoryId,
          date,
          note: note || undefined,
        });

        if (activeTab === "spent") {
          const openItems = await listOpenItems(userId);
          const suggestion = bestItemForTransaction(openItems, tx);
          if (suggestion) {
            toast.success("Saved", {
              description: `Link to ${suggestion.item.title}?`,
              action: {
                label: "Link",
                onClick: () => {
                  void linkItemToTransaction({
                    userId,
                    itemId: suggestion.item.id,
                    transactionId: tx.id,
                  }).then(() => toast.success("Linked to Expense"));
                },
              },
            });
            resetForm();
            onClose();
            return;
          }
        }
      } else if (healthType === "water") {
        await addHealthLog({
          userId,
          type: "water",
          value: 1,
          unit: profile.waterUnit,
        });
      } else {
        const hours = Number(sleepHours);
        if (!(hours > 0)) throw new Error("Enter sleep hours greater than 0.");
        await addHealthLog({
          userId,
          type: "sleep",
          value: hours,
          unit: "hours",
        });
      }

      toast.success("Saved");
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCategory() {
    if (!moduleForTab || !categorySearch.trim()) return;
    const cat = await createCategory({
      userId,
      name: categorySearch.trim(),
      module: moduleForTab,
    });
    setCategoryId(cat.id);
    setCategorySearch("");
  }

  const rateHint =
    currency !== baseCurrency && Number(rateInput) > 0
      ? `1 ${currency} = ${getCurrency(baseCurrency).symbol}${Number(rateInput).toLocaleString(profile?.locale ?? "en-NG")}`
      : null;

  return (
    <FormPanel open={open} onOpenChange={(v) => !v && onClose()}>
      <FormPanelContent>
        <FormPanelHeader className="gap-3">
          <FormPanelTitle>{heading.title}</FormPanelTitle>
          <FormPanelDescription>{heading.description}</FormPanelDescription>
          {scope.length > 1 && (
            <SegmentedControl
              value={activeTab}
              options={scope.map((value) => ({
                value,
                label: TAB_LABELS[value],
              }))}
              onChange={(v) => {
                setTab(v);
                setError(null);
              }}
            />
          )}
        </FormPanelHeader>

        <FormPanelBody>
          <div className="space-y-5">
            {activeTab === "task" && (
              <>
                <Field label="Title" htmlFor="qa-title">
                  <Input
                    id="qa-title"
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What needs doing?"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Date" htmlFor="qa-date">
                    <Input
                      id="qa-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Time" htmlFor="qa-time" optional>
                    <Input
                      id="qa-time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Repeat">
                  <Select
                    value={recurrence}
                    onValueChange={(v) =>
                      setRecurrence(v as RecurrenceFrequency)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            {isMoney && hasNoAccounts && (
              <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Wallet className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium">No accounts yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Money has to land somewhere. Add a cash, bank or wallet
                  account, then come back to log this.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/money" onClick={onClose}>
                    Add an account
                  </Link>
                </Button>
              </div>
            )}

            {isMoney && !hasNoAccounts && (
              <>
                <Field
                  label="Amount"
                  htmlFor="qa-amount"
                  hint={
                    currency !== baseCurrency
                      ? `Converted to ${baseCurrency} using the rate below`
                      : null
                  }
                >
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
                    <span className="text-xl font-medium text-muted-foreground">
                      {getCurrency(currency).symbol}
                    </span>
                    <input
                      id="qa-amount"
                      autoFocus
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent font-mono text-3xl tabular-nums outline-none placeholder:text-muted-foreground/40"
                    />
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {currency}
                    </span>
                  </div>
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Account">
                    <Select value={accountId} onValueChange={setAccountId}>
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
                  <Field label="Date" htmlFor="qa-tx-date">
                    <Input
                      id="qa-tx-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                </div>

                {currency !== baseCurrency && (
                  <Field
                    label={`Rate to ${baseCurrency}`}
                    htmlFor="qa-rate"
                    hint={rateHint}
                    error={
                      needsRate && !rateInput
                        ? `Enter an exchange rate for ${currency} to save this entry.`
                        : null
                    }
                  >
                    <Input
                      id="qa-rate"
                      inputMode="decimal"
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      placeholder={`1 ${currency} = ? ${baseCurrency}`}
                    />
                  </Field>
                )}
              </>
            )}

            {activeTab === "health" && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setHealthType("water")}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors",
                      healthType === "water"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <Droplets className="size-5 text-primary" />
                    <span className="text-sm font-medium">Water +1</span>
                    <span className="text-xs text-muted-foreground">
                      One {profile?.waterUnit === "ml" ? "serving" : "cup"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHealthType("sleep")}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors",
                      healthType === "sleep"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <Moon className="size-5 text-primary" />
                    <span className="text-sm font-medium">Sleep</span>
                    <span className="text-xs text-muted-foreground">
                      Hours last night
                    </span>
                  </button>
                </div>

                {healthType === "sleep" && (
                  <Field label="Hours" htmlFor="qa-sleep">
                    <Input
                      id="qa-sleep"
                      inputMode="decimal"
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value)}
                    />
                  </Field>
                )}

                <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
                  Akosile is a tracking tool and does not give medical advice.
                </p>
              </>
            )}

            {moduleForTab && !(isMoney && hasNoAccounts) && (
              <Field label="Category" hint="Recently used appear first.">
                <Input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search categories"
                  className="h-11"
                />
                <CategoryChips
                  categories={filteredCategories}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                  search={categorySearch}
                  onCreate={() => void handleCreateCategory()}
                />
              </Field>
            )}

            {activeTab !== "health" && !(isMoney && hasNoAccounts) && (
              <Field label="Note" htmlFor="qa-note" optional>
                <Input
                  id="qa-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a detail you'll want later"
                />
              </Field>
            )}

            {error && (
              <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
        </FormPanelBody>

        {!(isMoney && hasNoAccounts) && (
          <FormPanelFooter className="sm:[&_button]:w-full">
            <Button
              type="button"
              size="lg"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </FormPanelFooter>
        )}
      </FormPanelContent>
    </FormPanel>
  );
}

function CategoryChips({
  categories,
  selectedId,
  onSelect,
  search,
  onCreate,
}: {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  search: string;
  onCreate: () => void;
}) {
  const exactMatch = categories.some(
    (c) => c.name.toLowerCase() === search.trim().toLowerCase(),
  );

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
          selectedId === null
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/40",
        )}
      >
        {selectedId === null && <Check className="size-3" />}
        Uncategorised
      </button>

      {categories.map((c) => {
        const active = selectedId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
              active
                ? "border-transparent text-white"
                : "border-border bg-card text-foreground hover:border-primary/40",
            )}
            style={active ? { backgroundColor: c.color } : undefined}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: active ? "#fff" : c.color }}
            />
            {c.name}
          </button>
        );
      })}

      {search.trim() && !exactMatch && (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-xs font-medium text-primary"
        >
          <Plus className="size-3" />
          Create &ldquo;{search.trim()}&rdquo;
        </button>
      )}
    </div>
  );
}
