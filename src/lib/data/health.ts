import { endOfDay, startOfDay } from "date-fns";
import { getDb } from "@/lib/db";
import { enqueueUpsert } from "@/lib/sync/engine";
import { createId, nowIso } from "@/lib/utils";
import type { HealthLog, HealthLogType } from "@/types";

export async function addHealthLog(input: {
  userId: string;
  type: HealthLogType;
  value: number;
  unit: string;
  note?: string;
  title?: string;
  meal?: HealthLog["meal"];
}): Promise<HealthLog> {
  const stamp = nowIso();
  const log: HealthLog = {
    id: createId(),
    userId: input.userId,
    type: input.type,
    value: input.value,
    unit: input.unit,
    loggedAt: stamp,
    note: input.note ?? null,
    title: input.title?.trim() || null,
    meal: input.meal ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const db = getDb();
  await db.healthLogs.put(log);
  await enqueueUpsert("healthLogs", log.id, log);
  return log;
}

export async function getTodayHealthTotal(
  userId: string,
  type: HealthLogType,
  day = new Date(),
): Promise<number> {
  const db = getDb();
  const from = startOfDay(day).toISOString();
  const to = endOfDay(day).toISOString();
  const logs = await db.healthLogs.where({ userId, type }).toArray();
  return logs
    .filter((l) => l.loggedAt >= from && l.loggedAt <= to)
    .reduce((sum, l) => sum + Number(l.value), 0);
}

export async function getTodaySleepHours(
  userId: string,
  day = new Date(),
): Promise<number | null> {
  const db = getDb();
  const from = startOfDay(day).toISOString();
  const to = endOfDay(day).toISOString();
  const logs = await db.healthLogs.where({ userId, type: "sleep" }).toArray();
  const todays = logs
    .filter((l) => l.loggedAt >= from && l.loggedAt <= to)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  return todays[0] ? Number(todays[0].value) : null;
}

export async function listTodayHealthLogs(
  userId: string,
  type: HealthLogType,
  day = new Date(),
): Promise<HealthLog[]> {
  const db = getDb();
  const from = startOfDay(day).toISOString();
  const to = endOfDay(day).toISOString();
  const logs = await db.healthLogs.where({ userId, type }).toArray();
  return logs
    .filter((l) => l.loggedAt >= from && l.loggedAt <= to)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}
