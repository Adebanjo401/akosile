"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { format, parseISO, subDays } from "date-fns";
import { Droplets, Dumbbell, Minus, Moon, Plus, Utensils } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { getDb } from "@/lib/db";
import {
  addHealthLog,
  getTodayHealthTotal,
  getTodaySleepHours,
  listTodayHealthLogs,
} from "@/lib/data/health";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { HealthInsights } from "@/components/charts/HealthInsights";
import type { MealSlot } from "@/types";

const WATER_TARGET = 8;

const WORKOUTS = ["Walk", "Run", "Strength", "Stretch", "Home workout", "Sport"];

const MEALS: { slot: MealSlot; label: string }[] = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "dinner", label: "Dinner" },
  { slot: "snack", label: "Snack" },
];

export default function HealthPage() {
  const { userId, profile } = useApp();
  const [sleepHours, setSleepHours] = useState("7.5");
  const [workoutName, setWorkoutName] = useState("Walk");
  const [workoutMins, setWorkoutMins] = useState("30");
  const [foodTitle, setFoodTitle] = useState("");
  const [foodSlot, setFoodSlot] = useState<MealSlot>("breakfast");
  const [foodPortions, setFoodPortions] = useState("1");

  const water = useLiveQuery(async () => {
    if (!userId) return 0;
    return getTodayHealthTotal(userId, "water");
  }, [userId]);

  const sleep = useLiveQuery(async () => {
    if (!userId) return null;
    return getTodaySleepHours(userId);
  }, [userId]);

  const workouts = useLiveQuery(async () => {
    if (!userId) return [];
    return listTodayHealthLogs(userId, "workout");
  }, [userId]);

  const meals = useLiveQuery(async () => {
    if (!userId) return [];
    return listTodayHealthLogs(userId, "food");
  }, [userId]);

  const weekLogs = useLiveQuery(async () => {
    if (!userId) return [];
    const since = subDays(new Date(), 7).toISOString();
    const logs = await getDb().healthLogs.where({ userId }).toArray();
    return logs.filter((l) => l.loggedAt >= since);
  }, [userId]);

  if (!profile) return null;

  const progress = Math.min(100, ((water ?? 0) / WATER_TARGET) * 100);
  const workoutMinutes = (workouts ?? []).reduce(
    (sum, log) => sum + Number(log.value),
    0,
  );
  const mealBySlot = new Map(
    (meals ?? []).map((log) => [log.meal ?? "snack", log]),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="hidden md:block">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Health
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Water, sleep, workouts and meals for today.
        </p>
      </header>

      <p className="rounded-2xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
        Akosile is a tracking tool and does not give medical advice. Health data
        is private and excluded from exports unless you include it.
      </p>

      <HealthInsights logs={weekLogs ?? []} />

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Droplets className="size-4 text-primary" />
              Water
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums">
              {water ?? 0}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                / {WATER_TARGET} {profile.waterUnit}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove one"
              disabled={(water ?? 0) <= 0}
              onClick={async () => {
                await addHealthLog({
                  userId,
                  type: "water",
                  value: -1,
                  unit: profile.waterUnit,
                });
                toast.success("Removed");
              }}
            >
              <Minus />
            </Button>
            <Button
              type="button"
              size="icon"
              aria-label="Add one"
              onClick={async () => {
                await addHealthLog({
                  userId,
                  type: "water",
                  value: 1,
                  unit: profile.waterUnit,
                });
                toast.success("Saved");
              }}
            >
              <Plus />
            </Button>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Moon className="size-4 text-primary" />
          Sleep
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {sleep != null
            ? `Logged ${sleep} hours for today`
            : "Not logged yet today"}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Hours" htmlFor="sleep" className="w-32">
            <Input
              id="sleep"
              inputMode="decimal"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
            />
          </Field>
          <Button
            type="button"
            className="mb-0.5"
            onClick={async () => {
              const hours = Number(sleepHours);
              if (!(hours > 0)) {
                toast.error("Enter sleep hours greater than 0.");
                return;
              }
              await addHealthLog({
                userId,
                type: "sleep",
                value: hours,
                unit: "hours",
              });
              toast.success("Saved");
            }}
          >
            Save sleep
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Dumbbell className="size-4 text-primary" />
          Workout
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {workoutMinutes > 0
            ? `${workoutMinutes} minutes logged today`
            : "No movement logged today"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {WORKOUTS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setWorkoutName(name)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                workoutName === name
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Routine" htmlFor="workout-name" className="min-w-40 flex-1">
            <Input
              id="workout-name"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="What did you do?"
            />
          </Field>
          <Field label="Minutes" htmlFor="workout-mins" className="w-28">
            <Input
              id="workout-mins"
              inputMode="numeric"
              value={workoutMins}
              onChange={(e) => setWorkoutMins(e.target.value)}
            />
          </Field>
          <Button
            type="button"
            className="mb-0.5"
            onClick={async () => {
              const mins = Number(workoutMins);
              if (!(mins > 0) || !workoutName.trim()) {
                toast.error("Enter a routine and minutes greater than 0.");
                return;
              }
              await addHealthLog({
                userId,
                type: "workout",
                value: mins,
                unit: "minutes",
                title: workoutName.trim(),
              });
              toast.success("Workout saved");
            }}
          >
            Log workout
          </Button>
        </div>
        {(workouts ?? []).length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border pt-3">
            {(workouts ?? []).map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>{log.title ?? "Workout"}</span>
                <span className="tabular-nums text-muted-foreground">
                  {log.value} min · {format(parseISO(log.loggedAt), "HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Utensils className="size-4 text-primary" />
          Meals
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Log what you ate in portions — breakfast through snack.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MEALS.map(({ slot, label }) => {
            const logged = mealBySlot.get(slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setFoodSlot(slot)}
                className={`rounded-2xl border p-3 text-left ${
                  foodSlot === slot
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <p className="text-xs font-medium">{label}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {logged
                    ? `${logged.title ?? "Logged"} · ${logged.value}`
                    : "Not logged"}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="What you ate" htmlFor="food-title" className="min-w-48 flex-1">
            <Input
              id="food-title"
              value={foodTitle}
              onChange={(e) => setFoodTitle(e.target.value)}
              placeholder="e.g. Rice and stew"
            />
          </Field>
          <Field label="Portions" htmlFor="food-portions" className="w-28">
            <Input
              id="food-portions"
              inputMode="decimal"
              value={foodPortions}
              onChange={(e) => setFoodPortions(e.target.value)}
            />
          </Field>
          <Button
            type="button"
            className="mb-0.5"
            onClick={async () => {
              const portions = Number(foodPortions);
              if (!(portions > 0)) {
                toast.error("Enter portions greater than 0.");
                return;
              }
              await addHealthLog({
                userId,
                type: "food",
                value: portions,
                unit: "portions",
                title: foodTitle.trim() || MEALS.find((m) => m.slot === foodSlot)?.label,
                meal: foodSlot,
              });
              setFoodTitle("");
              toast.success("Meal saved");
            }}
          >
            Log meal
          </Button>
        </div>
      </section>
    </div>
  );
}
