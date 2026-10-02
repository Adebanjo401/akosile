"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { toast } from "sonner";
import { Archive, ChartNoAxesCombined, Cloud, CloudOff, Download, Trash2, Wallet } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { getDb } from "@/lib/db";
import { listCategories, updateCategory } from "@/lib/data/categories";
import { ensureLocalProfile } from "@/lib/data/bootstrap";
import { formatMoney, getAccountBalanceMinor } from "@/lib/data/money";
import { getOutboxErrors, syncNow } from "@/lib/sync/engine";
import { CURRENCIES } from "@/lib/money/currencies";
import type { CategoryModule } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddAccountDialog } from "@/components/money/AccountDialog";
import { SetRateDialog } from "@/components/money/RateDialog";

export default function MorePage() {
  const { userId, profile, setProfile, supabaseEnabled, online } = useApp();
  const [name, setName] = useState(profile?.name ?? "");
  const [baseCurrency, setBaseCurrency] = useState(
    profile?.baseCurrency ?? "NGN",
  );
  const [moduleFilter, setModuleFilter] = useState<CategoryModule | "all">(
    "all",
  );

  const categories = useLiveQuery(async () => {
    if (!userId) return [];
    if (moduleFilter === "all") {
      return getDb()
        .categories.where({ userId })
        .filter((c) => !c.archived)
        .toArray();
    }
    return listCategories(userId, moduleFilter);
  }, [userId, moduleFilter]);

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

  const syncErrors = useLiveQuery(async () => getOutboxErrors(), []);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (!profile) return null;

  async function saveProfile() {
    if (!profile) return;
    const updated = await ensureLocalProfile({
      id: userId,
      name: name.trim() || profile.name,
      baseCurrency,
      onboardingCompleted: true,
    });
    setProfile(updated);
    toast.success("Saved");
  }

  async function exportJson(includeHealth: boolean) {
    const db = getDb();
    const payload = {
      app: "Akosile",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      categories: await db.categories.where({ userId }).toArray(),
      accounts: await db.accounts.where({ userId }).toArray(),
      transactions: await db.transactions.where({ userId }).toArray(),
      transfers: await db.transfers.where({ userId }).toArray(),
      exchangeRates: await db.exchangeRates.where({ userId }).toArray(),
      tasks: await db.tasks.where({ userId }).toArray(),
      reminders: await db.reminders.where({ userId }).toArray(),
      healthLogs: includeHealth
        ? await db.healthLogs.where({ userId }).toArray()
        : undefined,
      householdItems: await db.householdItems.where({ userId }).toArray(),
      budgets: await db.budgets.where({ userId }).toArray(),
    };
    download(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
      `akosile-export-${new Date().toISOString().slice(0, 10)}.json`,
    );
    toast.success("Export downloaded");
  }

  async function exportCsv() {
    const txs = await getDb().transactions.where({ userId }).toArray();
    const header = [
      "date",
      "type",
      "amount_minor",
      "currency",
      "rate_to_base",
      "amount_base_minor",
      "category_id",
      "account_id",
      "note",
    ];
    const rows = txs.map((t) =>
      [
        t.date,
        t.type,
        t.amountMinor,
        t.currency,
        t.rateToBase,
        t.amountBaseMinor,
        t.categoryId ?? "",
        t.accountId,
        JSON.stringify(t.note ?? ""),
      ].join(","),
    );
    download(
      new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" }),
      `akosile-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success("CSV downloaded");
  }

  async function wipeLocalData() {
    if (
      !window.confirm(
        "Delete all Akosile data on this device? This cannot be undone.",
      )
    )
      return;
    if (!window.confirm("Confirm again to permanently delete local data."))
      return;
    await getDb().delete();
    localStorage.clear();
    window.location.href = "/";
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Settings</h1>

      <Section title="Profile">
        <Field label="Name" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Base currency"
          hint="Totals and reports use this currency."
        >
          <Select value={baseCurrency} onValueChange={setBaseCurrency}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CURRENCIES).map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="text-xs text-muted-foreground">
          Time zone: {profile.timezone}
        </p>
        <Button type="button" onClick={() => void saveProfile()}>
          Save changes
        </Button>
      </Section>

      <Section title="Accounts" id="accounts">
        <p className="text-sm text-muted-foreground">
          Cash, bank and wallets you spend from. Money logs against these.
        </p>
        <div className="flex justify-end">
          <AddAccountDialog userId={userId} baseCurrency={profile.baseCurrency} />
        </div>
        {(accounts ?? []).length === 0 ? (
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
            No accounts yet.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {(accounts ?? []).map(({ account, balanceMinor }) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-3 px-3 py-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Wallet className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {account.name}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {account.type.replace("_", " ")} · {account.currency}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {formatMoney(balanceMinor, account.currency, profile.locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Exchange rates" id="rates">
        <p className="text-sm text-muted-foreground">
          Manual rates used when an account is not in {profile.baseCurrency}.
        </p>
        <div className="flex justify-end">
          <SetRateDialog userId={userId} baseCurrency={profile.baseCurrency} />
        </div>
        {(rates ?? []).length === 0 ? (
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
            No rates saved.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {(rates ?? []).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-3 py-3 text-sm"
              >
                <span>
                  1 {r.currency} ={" "}
                  <span className="font-mono tabular-nums">
                    {r.rateToBase.toLocaleString(profile.locale)}
                  </span>{" "}
                  {profile.baseCurrency}
                </span>
                <span className="text-xs text-muted-foreground">{r.source}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Sync">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              online
                ? "bg-success/10 text-success"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {online ? (
              <Cloud className="size-3.5" />
            ) : (
              <CloudOff className="size-3.5" />
            )}
            {online ? "Online" : "Offline"}
          </span>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Supabase {supabaseEnabled ? "configured" : "local-only"}
          </span>
        </div>

        {supabaseEnabled ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/login">Sign in to sync across devices</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void syncNow().then(() => toast.success("Sync attempted"))
              }
            >
              Sync now
            </Button>
          </div>
        ) : (
          <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
            <code>.env.local</code>, then run the SQL in{" "}
            <code>supabase/migrations/</code> (001 through 003).
          </p>
        )}

        {(syncErrors ?? []).length > 0 && (
          <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {(syncErrors ?? [])[0].lastError}
            {(syncErrors ?? []).length > 1
              ? ` · ${(syncErrors ?? []).length} queued errors`
              : ""}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Reminders always appear in the in-app Missed list. Browser push only
          fires when Akosile is installed or open and notifications are allowed.
        </p>
      </Section>

      <Section title="Categories">
        <Select
          value={moduleFilter}
          onValueChange={(v) => setModuleFilter(v as CategoryModule | "all")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            <SelectItem value="money-expense">Money · expense</SelectItem>
            <SelectItem value="money-income">Money · income</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="health">Health</SelectItem>
            <SelectItem value="household">Expense</SelectItem>
          </SelectContent>
        </Select>

        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {(categories ?? []).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="truncate">{c.name}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() =>
                  void updateCategory(userId, c.id, { archived: true }).then(
                    () => toast.success(`${c.name} archived`),
                  )
                }
              >
                <Archive />
                Archive
              </Button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Data">
        <Button asChild variant="outline">
          <Link href="/reports">
            <ChartNoAxesCombined />
            Open Reports
          </Link>
        </Button>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void exportJson(false)}
          >
            <Download />
            JSON (no health)
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void exportJson(true)}
          >
            <Download />
            JSON (with health)
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void exportCsv()}
            className="sm:col-span-2"
          >
            <Download />
            Transactions CSV
          </Button>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void wipeLocalData()}
        >
          <Trash2 />
          Delete all local data
        </Button>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 space-y-4 rounded-2xl border border-border bg-card p-5"
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
