import { getDb } from "@/lib/db";
import { enqueueDelete, enqueueUpsert } from "@/lib/sync/engine";
import { nextOccurrence } from "@/lib/tasks/recurrence";
import { createId, nowIso } from "@/lib/utils";
import type { RecurrenceRule, Reminder, Task } from "@/types";

export async function createTask(input: {
  userId: string;
  title: string;
  categoryId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  recurrence?: RecurrenceRule;
  reminderOffsetsMinutes?: number[];
}): Promise<Task> {
  const stamp = nowIso();
  const title = input.title.trim();
  if (!title) throw new Error("Enter a task title.");

  const task: Task = {
    id: createId(),
    userId: input.userId,
    title,
    categoryId: input.categoryId ?? null,
    dueAt: input.dueAt ?? stamp,
    recurrence: input.recurrence ?? { frequency: "none", interval: 1 },
    seriesId: null,
    status: "pending",
    notes: input.notes ?? null,
    completedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  };

  if (task.recurrence.frequency !== "none") {
    task.seriesId = task.id;
  }

  const db = getDb();
  await db.tasks.put(task);
  await enqueueUpsert("tasks", task.id, task);

  if (input.reminderOffsetsMinutes?.length && task.dueAt) {
    const due = new Date(task.dueAt);
    for (const offset of input.reminderOffsetsMinutes) {
      const fire = new Date(due.getTime() - offset * 60_000);
      const reminder: Reminder = {
        id: createId(),
        userId: input.userId,
        itemType: "task",
        itemId: task.id,
        fireAt: fire.toISOString(),
        offsetMinutes: offset,
        channel: "in_app",
        status: "pending",
        snoozeUntil: null,
        createdAt: stamp,
        updatedAt: stamp,
      };
      await db.reminders.put(reminder);
      await enqueueUpsert("reminders", reminder.id, reminder);
    }
  }

  return task;
}

export async function completeTask(userId: string, taskId: string): Promise<void> {
  const db = getDb();
  const task = await db.tasks.get(taskId);
  if (!task || task.userId !== userId) return;

  const stamp = nowIso();
  const updated: Task = {
    ...task,
    status: "completed",
    completedAt: stamp,
    updatedAt: stamp,
  };
  await db.tasks.put(updated);
  await enqueueUpsert("tasks", updated.id, updated);

  // Clear pending reminders for this task
  const reminders = await db.reminders.where({ itemId: taskId }).toArray();
  for (const r of reminders) {
    if (r.status === "pending" || r.status === "snoozed" || r.status === "missed") {
      const done = { ...r, status: "done" as const, updatedAt: stamp };
      await db.reminders.put(done);
      await enqueueUpsert("reminders", done.id, done);
    }
  }

  if (task.recurrence.frequency !== "none" && task.dueAt) {
    const nextDue = nextOccurrence(new Date(task.dueAt), task.recurrence);
    if (nextDue) {
      const next: Task = {
        id: createId(),
        userId,
        title: task.title,
        categoryId: task.categoryId,
        dueAt: nextDue.toISOString(),
        recurrence: task.recurrence,
        seriesId: task.seriesId ?? task.id,
        status: "pending",
        notes: task.notes,
        completedAt: null,
        createdAt: stamp,
        updatedAt: stamp,
      };
      await db.tasks.put(next);
      await enqueueUpsert("tasks", next.id, next);
    }
  }
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const db = getDb();
  const task = await db.tasks.get(taskId);
  if (!task || task.userId !== userId) return;
  await db.tasks.delete(taskId);
  await enqueueDelete("tasks", taskId);
}

export async function rescheduleTask(
  userId: string,
  taskId: string,
  dueAt: string,
): Promise<void> {
  const db = getDb();
  const task = await db.tasks.get(taskId);
  if (!task || task.userId !== userId) return;
  const updated = { ...task, dueAt, updatedAt: nowIso(), status: "pending" as const };
  await db.tasks.put(updated);
  await enqueueUpsert("tasks", updated.id, updated);
}

export async function markMissedReminders(userId: string): Promise<number> {
  const db = getDb();
  const now = Date.now();
  const pending = await db.reminders
    .where({ userId, status: "pending" })
    .toArray();
  let count = 0;
  for (const r of pending) {
    if (new Date(r.fireAt).getTime() < now) {
      const updated = { ...r, status: "missed" as const, updatedAt: nowIso() };
      await db.reminders.put(updated);
      await enqueueUpsert("reminders", updated.id, updated);
      count += 1;
    }
  }
  return count;
}

export async function snoozeReminder(
  userId: string,
  reminderId: string,
  minutes: number,
): Promise<void> {
  const db = getDb();
  const r = await db.reminders.get(reminderId);
  if (!r || r.userId !== userId) return;
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  const updated = {
    ...r,
    status: "snoozed" as const,
    snoozeUntil: until,
    fireAt: until,
    updatedAt: nowIso(),
  };
  await db.reminders.put(updated);
  await enqueueUpsert("reminders", updated.id, updated);
}
