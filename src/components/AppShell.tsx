"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  HeartPulse,
  Receipt,
  LayoutDashboard,
  Settings2,
  Wallet,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";

const PRIMARY_NAV = [
  {
    href: "/today",
    label: "Today",
    description: "This day's overview",
    icon: LayoutDashboard,
    module: null,
  },
  {
    href: "/schedule",
    label: "Schedule",
    description: "Tasks and routines",
    icon: CalendarDays,
    module: "schedule" as const,
  },
  {
    href: "/money",
    label: "Money",
    description: "Accounts and spending",
    icon: Wallet,
    module: "money" as const,
  },
  {
    href: "/expense",
    label: "Expense",
    description: "Budgets and planned spend",
    icon: Receipt,
    module: "household" as const,
  },
  {
    href: "/health",
    label: "Health",
    description: "Water, food and movement",
    icon: HeartPulse,
    module: "health" as const,
  },
] as const;

const REPORTS_NAV = {
  href: "/reports",
  label: "Reports",
  description: "Full profile analytics",
  icon: ChartNoAxesCombined,
} as const;

const SETTINGS_NAV = {
  href: "/more",
  label: "Settings",
  description: "Accounts, rates and data",
  icon: Settings2,
} as const;

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { online, profile } = useApp();

  const primary = PRIMARY_NAV.filter((item) => {
    if (!item.module) return true;
    return profile?.modules[item.module] !== false;
  });

  const current =
    [...primary, REPORTS_NAV, SETTINGS_NAV].find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? primary[0];

  const settingsActive =
    pathname === SETTINGS_NAV.href || pathname.startsWith(`${SETTINGS_NAV.href}/`);
  const reportsActive =
    pathname === REPORTS_NAV.href || pathname.startsWith(`${REPORTS_NAV.href}/`);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card px-4 py-6 md:flex">
          <Link href="/today" className="mb-6 block px-2">
            <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-primary">
              Akosile
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {profile?.name ? `${profile.name}'s day` : "Your day"}
            </p>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {primary.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} />
            ))}
            <div className="mt-auto space-y-1 pt-4">
              <SidebarLink item={REPORTS_NAV} pathname={pathname} />
              <SidebarLink item={SETTINGS_NAV} pathname={pathname} />
            </div>
          </nav>

          {!online && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
              <WifiOff className="size-3.5 shrink-0" />
              Offline — syncing when you reconnect
            </p>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-primary">
                {current.label}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {current.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!online && (
                <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <WifiOff className="size-3.5" />
                  Offline
                </span>
              )}
              <Link
                href={REPORTS_NAV.href}
                aria-label="Reports"
                aria-current={reportsActive ? "page" : undefined}
                className={cn(
                  "flex size-11 items-center justify-center rounded-full border transition-colors",
                  reportsActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <ChartNoAxesCombined className="size-4" />
              </Link>
              <Link
                href={SETTINGS_NAV.href}
                aria-label="Settings"
                aria-current={settingsActive ? "page" : undefined}
                className={cn(
                  "flex size-11 items-center justify-center rounded-full border transition-colors",
                  settingsActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Settings2 className="size-4" />
              </Link>
            </div>
          </header>

          <main className="flex-1 pb-24 md:pb-10">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch">
          {primary.map((item) => (
            <MobileNavItem key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function SidebarLink({
  item,
  pathname,
}: {
  item: {
    href: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  pathname: string;
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{item.label}</span>
        <span
          className={cn(
            "block truncate text-xs",
            active ? "text-primary/70" : "text-muted-foreground/80",
          )}
        >
          {item.description}
        </span>
      </span>
    </Link>
  );
}

function MobileNavItem({
  item,
  pathname,
}: {
  item: (typeof PRIMARY_NAV)[number];
  pathname: string;
}) {
  const active =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <li className="flex-1">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full transition-colors",
            active && "bg-primary/10",
          )}
        >
          <Icon className="size-5" />
        </span>
        {item.label}
      </Link>
    </li>
  );
}
