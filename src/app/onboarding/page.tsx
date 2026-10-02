"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { AppProvider, useApp } from "@/lib/app-context";
import { completeOnboarding } from "@/lib/data/bootstrap";
import { CURRENCIES } from "@/lib/money/currencies";
import { getDeviceTimezone, cn } from "@/lib/utils";
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

const MODULES = [
  {
    key: "schedule",
    label: "Schedule & tasks",
    description: "Plan your day and repeat routines",
  },
  {
    key: "money",
    label: "Money",
    description: "Accounts, spending and currencies",
  },
  {
    key: "health",
    label: "Health",
    description: "Water, sleep, workouts and meals",
  },
  {
    key: "household",
    label: "Expense",
    description: "Budgets, planned spend and matching to Money",
  },
] as const;

function OnboardingFlow() {
  const router = useRouter();
  const { setProfile, ready } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("NGN");
  const [timezone] = useState(getDeviceTimezone());
  const [modules, setModules] = useState({
    schedule: true,
    money: true,
    health: true,
    household: true,
  });
  const [saving, setSaving] = useState(false);

  async function finish(skip = false) {
    setSaving(true);
    const profile = await completeOnboarding({
      name: skip ? "You" : name,
      baseCurrency: skip ? "NGN" : baseCurrency,
      timezone,
      modules: skip
        ? { schedule: true, money: true, health: true, household: true }
        : modules,
    });
    setProfile(profile);
    setSaving(false);
    router.replace("/today");
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
      <div>
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-primary">
          Akosile
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Money, health, schedule and reminders — in one place.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mt-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>

      <div className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6">
        {step === 0 && (
          <>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                What should we call you?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Step 1 of 3
              </p>
            </div>
            <Field label="Your name" htmlFor="ob-name">
              <Input
                id="ob-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada"
              />
            </Field>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                Base currency
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Totals use this currency. Time zone: {timezone}
              </p>
            </div>
            <Field label="Currency">
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setStep(0)}
              >
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                Which modules?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                You can change this later in settings.
              </p>
            </div>

            <div className="space-y-2">
              {MODULES.map(({ key, label, description }) => {
                const on = modules[key];
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setModules((m) => ({ ...m, [key]: !m[key] }))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
                      on
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {on && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={saving}
                className="flex-1"
                onClick={() => void finish(false)}
              >
                {saving ? "Setting up…" : "Start using Akosile"}
              </Button>
            </div>
          </>
        )}
      </div>

      <Button
        type="button"
        variant="link"
        disabled={saving}
        className="mt-6 text-muted-foreground"
        onClick={() => void finish(true)}
      >
        Skip — use defaults (NGN, all modules)
      </Button>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AppProvider>
      <OnboardingFlow />
    </AppProvider>
  );
}
