"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppProvider, useApp } from "@/lib/app-context";
import { AppShell } from "@/components/AppShell";
import { QuickAddProvider } from "@/lib/quick-add";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { ready, profile, bootError } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (ready && profile && !profile.onboardingCompleted) {
      router.replace("/onboarding");
    }
  }, [ready, profile, router]);

  if (bootError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-primary">
            Akosile
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Local storage could not be opened: {bootError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (!ready || !profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading Akosile…</p>
      </div>
    );
  }

  return (
    <QuickAddProvider>
      <AppShell>{children}</AppShell>
    </QuickAddProvider>
  );
}

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AppProvider>
  );
}
