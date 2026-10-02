"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format, isBefore, isToday, parseISO, startOfDay } from "date-fns";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Droplets,
  Dumbbell,
  Receipt,
  Moon,
  Plus,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useQuickAdd } from "@/lib/quick-add";
import { getDb } from "@/lib/db";
import { completeTask, deleteTask, rescheduleTask } from "@/lib/data/tasks";
import { formatMoney } from "@/lib/data/money";
import {
  addHealthLog,
  getTodayHealthTotal,
  getTodaySleepHours,
} from "@/lib/data/health";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Account, Category, CurrencyCode, Task, Transaction } from "@/types";

const WATER_TARGET = 8;

/** Local calendar day as `yyyy-MM-dd`, matching how transactions store dates. */
function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export default function TodayPage() {
  const { userId, profile } = useApp();
  const quickAdd = useQuickAdd();
  const day = todayKey();

  const tasks = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().tasks.where({ userId }).toArray();
  }, [userId]);

  const missed = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().reminders.where({ userId, status: "missed" }).toArray();
  }, [userId]);

  const transactions = useLiveQuery(async () => {
    if (!userId) return [];
    const all = await getDb().transactions.where({ userId }).toArray();
    return all
      .filter((t) => t.date === day && t.status === "cleared")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [userId, day]);

  const accounts = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().accounts.where({ userId }).toArray();
  }, [userId]);

  const categories = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().categories.where({ userId }).toArray();
  }, [userId]);

  const water = useLiveQuery(async () => {
    if (!userId) return 0;
    return getTodayHealthTotal(userId, "water");
  }, [userId]);

  const sleep = useLiveQuery(async () => {
    if (!userId) return null;
    return getTodaySleepHours(userId);
  }, [userId]);

  const workoutMinutes = useLiveQuery(async () => {
    if (!userId) return 0;
    return getTodayHealthTotal(userId, "workout");
  }, [userId]);

  const mealsLogged = useLiveQuery(async () => {
    if (!userId) return 0;
    return getTodayHealthTotal(userId, "food");
  }, [userId]);

  const householdNeeded = useLiveQuery(async () => {
    if (!userId) return [];
    const all = await getDb().householdItems.where({ userId }).toArray();
    return all.filter((item) => item.status === "needed");
  }, [userId]);

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );
  const accountById = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a])),
    [accounts],
  );

  const { overdue, dueToday, undated, doneToday } = useMemo(() => {
    const list = tasks ?? [];
    const startToday = startOfDay(new Date());
    const byDue = (a: Task, b: Task) =>
      (a.dueAt ?? "").localeCompare(b.dueAt ?? "");

    return {
      overdue: list
        .filter(
          (t) =>
            t.status === "pending" &&
            t.dueAt &&
            isBefore(parseISO(t.dueAt), startToday),
        )
        .sort(byDue),
      dueToday: list
        .filter(
          (t) => t.status === "pending" && t.dueAt && isToday(parseISO(t.dueAt)),
        )
        .sort(byDue),
      undated: list
        .filter((t) => t.status === "pending" && !t.dueAt)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      doneToday: list
        .filter(
          (t) =>
            t.status === "completed" &&
            t.completedAt &&
            isToday(parseISO(t.completedAt)),
        )
        .sort(byDue),
    };
  }, [tasks]);

  const moneyToday = useMemo(() => {
    let spent = 0;
    let received = 0;
    for (const tx of transactions ?? []) {
      if (tx.type === "expense") spent += tx.amountBaseMinor;
      else received += tx.amountBaseMinor;
    }
    return { spent, received };
  }, [transactions]);

  if (!profile) return null;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const locale = profile.locale;
  const base = profile.baseCurrency;
  const showSchedule = profile.modules.schedule;
  const showMoney = profile.modules.money;
  const showHealth = profile.modules.health;
  const showHousehold = profile.modules.household !== false;
  const openCount = overdue.length + dueToday.length + undated.length;
  const missedCount = missed?.length ?? 0;
  const txCount = transactions?.length ?? 0;
  const waterCups = water ?? 0;
  const homeCount = householdNeeded?.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 md:px-8 md:py-8">
      <header>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, d MMMM")}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {greeting}, {profile.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Today&apos;s tasks, money, expenses and health in one place.
        </p>
      </header>

      <GlanceStrip
        showSchedule={showSchedule}
        showMoney={showMoney}
        showHealth={showHealth}
        showHousehold={showHousehold}
        openCount={openCount}
        doneCount={doneToday.length}
        spent={moneyToday.spent}
        received={moneyToday.received}
        waterCups={waterCups}
        sleep={sleep ?? null}
        homeCount={homeCount}
        waterUnit={profile.waterUnit}
        base={base}
        locale={locale}
      />

      {missedCount > 0 && (
        <section className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="size-4" />
            {missedCount} missed reminder{missedCount > 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            These were due while Akosile was closed.
          </p>
          <ul className="mt-3 space-y-1">
            {missed?.slice(0, 4).map((r) => (
              <li key={r.id} className="text-sm capitalize">
                {r.itemType} · {format(parseISO(r.fireAt), "d MMM, HH:mm")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showSchedule && (
        <section className="space-y-3">
          <SectionHeader
            title="Tasks"
            meta={
              openCount > 0
                ? `${openCount} open${doneToday.length ? ` · ${doneToday.length} done` : ""}`
                : doneToday.length > 0
                  ? `${doneToday.length} done`
                  : "Nothing planned"
            }
            href="/schedule"
            viewLabel="Schedule"
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickAdd.open(["task"])}
              >
                <Plus />
                Add task
              </Button>
            }
          />

          {openCount === 0 && doneToday.length === 0 ? (
            <EmptyCard
              icon={<Sparkles className="size-5" />}
              title="You're clear for today"
              body="Nothing is due. Add a task when something comes up."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickAdd.open(["task"])}
                >
                  <Plus />
                  Add task
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {overdue.length > 0 && (
                <TaskGroup
                  label="Overdue"
                  tone="danger"
                  tasks={overdue}
                  userId={userId}
                  categoryById={categoryById}
                />
              )}
              {dueToday.length > 0 && (
                <TaskGroup
                  label="Due today"
                  tasks={dueToday}
                  userId={userId}
                  categoryById={categoryById}
                />
              )}
              {undated.length > 0 && (
                <TaskGroup
                  label="No date"
                  tasks={undated}
                  userId={userId}
                  categoryById={categoryById}
                />
              )}
              {doneToday.length > 0 && (
                <TaskGroup
                  label="Completed today"
                  tasks={doneToday}
                  userId={userId}
                  categoryById={categoryById}
                />
              )}
            </div>
          )}
        </section>
      )}

      {showMoney && (
        <section className="space-y-3">
          <SectionHeader
            title="Money"
            meta={
              txCount > 0
                ? `${txCount} entr${txCount === 1 ? "y" : "ies"} today`
                : "Nothing logged"
            }
            href="/money"
            viewLabel="All money"
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => quickAdd.open(["spent"])}
                >
                  <ArrowUpRight />
                  Spent
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => quickAdd.open(["received"])}
                >
                  <ArrowDownLeft />
                  Received
                </Button>
              </>
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-primary px-4 py-4 text-primary-foreground">
              <p className="flex items-center gap-1.5 text-xs text-primary-foreground/70">
                <ArrowUpRight className="size-3.5" />
                Spent today
              </p>
              <p className="mt-1.5 font-mono text-2xl tabular-nums">
                {formatMoney(moneyToday.spent, base, locale)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDownLeft className="size-3.5" />
                Received today
              </p>
              <p className="mt-1.5 font-mono text-2xl tabular-nums text-success">
                {formatMoney(moneyToday.received, base, locale)}
              </p>
            </div>
          </div>

          {txCount === 0 ? (
            <EmptyCard
              icon={<ArrowUpRight className="size-5" />}
              title="No transactions today"
              body="Log what you spent or received to keep today's numbers honest."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickAdd.open(["spent"])}
                >
                  <Plus />
                  Log spend
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {(transactions ?? []).map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  category={tx.categoryId ? categoryById.get(tx.categoryId) : null}
                  account={accountById.get(tx.accountId)}
                  base={base}
                  locale={locale}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {showHousehold && (
        <section className="space-y-3">
          <SectionHeader
            title="Expense"
            meta={
              homeCount > 0
                ? `${homeCount} open`
                : "List is clear"
            }
            href="/expense"
            viewLabel="All items"
          />
          {homeCount === 0 ? (
            <EmptyCard
              icon={<Receipt className="size-5" />}
              title="Nothing to spend on"
              body="Add groceries or a repair when something comes up."
              action={
                <Button asChild variant="outline">
                  <Link href="/expense">
                    <Plus />
                    Add item
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {(householdNeeded ?? []).slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {item.kind === "grocery"
                        ? "Grocery"
                        : item.kind === "repair"
                          ? "Fix"
                          : "Other"}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/expense">Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showHealth && (
        <section className="space-y-3">
          <SectionHeader
            title="Health"
            meta={`${waterCups} of ${WATER_TARGET} ${profile.waterUnit}${
              sleep != null ? ` · ${sleep}h sleep` : ""
            }${
              (workoutMinutes ?? 0) > 0
                ? ` · ${workoutMinutes} min workout`
                : ""
            }`}
            href="/health"
            viewLabel="Health log"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Droplets className="size-4 text-primary" />
                    Water
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {waterCups}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      of {WATER_TARGET} {profile.waterUnit}
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  aria-label="Add one serving of water"
                  onClick={() =>
                    void addHealthLog({
                      userId,
                      type: "water",
                      value: 1,
                      unit: profile.waterUnit,
                    })
                  }
                >
                  <Plus />
                  One
                </Button>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (waterCups / WATER_TARGET) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Moon className="size-4 text-primary" />
                Sleep
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {sleep != null ? (
                  <>
                    {sleep}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      hours
                    </span>
                  </>
                ) : (
                  <span className="text-base font-normal text-muted-foreground">
                    Not logged yet
                  </span>
                )}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/health">
                  {sleep != null ? "Update sleep" : "Log sleep"}
                </Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Dumbbell className="size-4 text-primary" />
                Workout
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {workoutMinutes ?? 0}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  minutes
                </span>
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/health">Log workout</Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Utensils className="size-4 text-primary" />
                Meals
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {mealsLogged ?? 0}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  portions today
                </span>
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/health">Log meal</Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function GlanceStrip({
  showSchedule,
  showMoney,
  showHealth,
  showHousehold,
  openCount,
  doneCount,
  spent,
  received,
  waterCups,
  sleep,
  homeCount,
  waterUnit,
  base,
  locale,
}: {
  showSchedule: boolean;
  showMoney: boolean;
  showHealth: boolean;
  showHousehold: boolean;
  openCount: number;
  doneCount: number;
  spent: number;
  received: number;
  waterCups: number;
  sleep: number | null;
  homeCount: number;
  waterUnit: string;
  base: CurrencyCode;
  locale: string;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {showSchedule && (
        <li className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Tasks</p>
          <p className="mt-0.5 text-sm font-semibold">
            {openCount > 0
              ? `${openCount} open`
              : doneCount > 0
                ? `${doneCount} done`
                : "Clear"}
          </p>
        </li>
      )}
      {showMoney && (
        <li className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Money</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {spent === 0 && received === 0
              ? "Nothing yet"
              : spent > 0
                ? formatMoney(spent, base, locale)
                : `+${formatMoney(received, base, locale)}`}
          </p>
        </li>
      )}
      {showHousehold && (
        <li className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Expense</p>
          <p className="mt-0.5 text-sm font-semibold">
            {homeCount === 0 ? "Clear" : `${homeCount} open`}
          </p>
        </li>
      )}
      {showHealth && (
        <li className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Health</p>
          <p className="mt-0.5 text-sm font-semibold">
            {waterCups}/{WATER_TARGET} {waterUnit}
            {sleep != null ? ` · ${sleep}h` : ""}
          </p>
        </li>
      )}
    </ul>
  );
}

function SectionHeader({
  title,
  meta,
  href,
  viewLabel,
  actions,
}: {
  title: string;
  meta: string;
  href: string;
  viewLabel: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {actions}
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>
            {viewLabel}
            <ChevronRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

function TaskGroup({
  label,
  tone,
  tasks,
  userId,
  categoryById,
}: {
  label: string;
  tone?: "danger";
  tasks: Task[];
  userId: string;
  categoryById: Map<string, Category>;
}) {
  return (
    <div className="space-y-2">
      <p
        className={cn(
          "px-1 text-xs font-semibold uppercase tracking-wide",
          tone === "danger" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {label} · {tasks.length}
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            userId={userId}
            category={task.categoryId ? categoryById.get(task.categoryId) : null}
          />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  userId,
  category,
}: {
  task: Task;
  userId: string;
  category?: Category | null;
}) {
  const done = task.status === "completed";

  return (
    <li className="flex items-start gap-3 px-3 py-3">
      {done ? (
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
          <Check className="size-4" />
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Complete ${task.title}`}
          onClick={() => void completeTask(userId, task.id)}
          className="mt-0.5 shrink-0 border-2 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Check />
        </Button>
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-medium",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {task.dueAt && (
            <span className="text-xs text-muted-foreground">
              {format(parseISO(task.dueAt), "d MMM · HH:mm")}
            </span>
          )}
          {category && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `${category.color}1f`,
                color: category.color,
              }}
            >
              {category.name}
            </span>
          )}
          {task.recurrence.frequency !== "none" && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
              {task.recurrence.frequency}
            </span>
          )}
        </div>

        {!done && (
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                void rescheduleTask(userId, task.id, tomorrow.toISOString());
              }}
            >
              Tomorrow
            </button>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:underline"
              onClick={() => void deleteTask(userId, task.id)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function TransactionRow({
  tx,
  category,
  account,
  base,
  locale,
}: {
  tx: Transaction;
  category?: Category | null;
  account?: Account;
  base: CurrencyCode;
  locale: string;
}) {
  const income = tx.type === "income";

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: category ? `${category.color}1f` : "var(--secondary)",
          color: category ? category.color : "var(--muted-foreground)",
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
        <p className="truncate text-xs text-muted-foreground">
          {[account?.name, tx.note].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "font-mono text-sm tabular-nums",
            income ? "text-success" : "text-foreground",
          )}
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
    </li>
  );
}
