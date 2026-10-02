"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppProvider, useApp } from "@/lib/app-context";

function Gate() {
  const router = useRouter();
  const { ready, profile } = useApp();

  useEffect(() => {
    if (!ready || !profile) return;
    if (!profile.onboardingCompleted) {
      router.replace("/onboarding");
    } else {
      router.replace("/today");
    }
  }, [ready, profile, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="text-center">
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-primary">
          Akosile
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}
