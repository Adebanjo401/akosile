"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, isPast, isToday, isTomorrow, parseISO } from "date-fns";
import { Check, Plus, Repeat } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useQuickAdd } from "@/lib/quick-add";
import { getDb } from "@/lib/db";
import { completeTask, deleteTask } from "@/lib/data/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { Task } from "@/types";

type Filter = "open" | "done";

function groupLabel(dueAt: string | null | undefined): string {
  if (!dueAt) return "No date";
  const d = parseISO(dueAt);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isPast(d)) return "Overdue";
  return format(d, "EEEE, d MMMM");
}

export default function SchedulePage() {
  const { userId } = useApp();
  const quickAdd = useQuickAdd();
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");

  const tasks = useLiveQuery(async () => {
    if (!userId) return [];
    const all = await getDb().tasks.where({ userId }).toArray();
    return all.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  }, [userId]);

  const categories = useLiveQuery(async () => {
    if (!userId) return [];
    return getDb().categories.where({ userId }).toArray();
  }, [userId]);

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks ?? [])
      .filter((t) =>
        filter === "open" ? t.status === "pending" : t.status === "completed",
      )
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true));
  }, [tasks, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of visible) {
      const key = filter === "done" ? "Completed" : groupLabel(task.dueAt);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    // Keep Overdue and Today at the top
    const order = ["Overdue", "Today", "Tomorrow"];
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return 0;
    });
  }, [visible, filter]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="sr-only">Schedule</h1>
        <Button
          type="button"
          onClick={() => quickAdd.open(["task"])}
          className="ml-auto"
        >
          <Plus />
          New task
        </Button>
      </header>

      <div className="space-y-3">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open" },
            { value: "done", label: "Completed" },
          ]}
          className="max-w-xs"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks"
          className="h-11"
        />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium">
            {filter === "open" ? "Nothing scheduled" : "Nothing completed yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "open"
              ? "Use New task to plan your first one."
              : "Completed tasks will appear here."}
          </p>
          {filter === "open" && (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => quickAdd.open(["task"])}
            >
              <Plus />
              New task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <section key={label} className="space-y-2">
              <h2
                className={`px-1 text-xs font-semibold uppercase tracking-wide ${
                  label === "Overdue" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {label} · {items.length}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {items.map((task) => {
                  const category = task.categoryId
                    ? categoryById.get(task.categoryId)
                    : null;
                  return (
                    <li
                      key={task.id}
                      className="flex items-start gap-3 px-3 py-3"
                    >
                      {task.status === "pending" ? (
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
                      ) : (
                        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                          <Check className="size-4" />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-medium ${
                            task.status === "completed"
                              ? "text-muted-foreground line-through"
                              : ""
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {task.dueAt
                              ? format(parseISO(task.dueAt), "d MMM · HH:mm")
                              : "No date"}
                          </span>
                          {category && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: `${category.color}1f`,
                                color: category.color,
                              }}
                            >
                              {category.name}
                            </span>
                          )}
                          {task.recurrence.frequency !== "none" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                              <Repeat className="size-3" />
                              {task.recurrence.frequency}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void deleteTask(userId, task.id)}
                        className="shrink-0 self-center text-xs font-medium text-muted-foreground hover:text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
