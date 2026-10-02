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

const GUTTER = "px-4 sm:px-6 lg:px-8";

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

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

interface AppShellProps {
  children: React.ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { online, profile } = useApp();

  const primary = PRIMARY_NAV.filter((item) => {
    if (!item.module) return true;
    return profile?.modules[item.module] !== false;
  });

  const current =
    [...primary, REPORTS_NAV, SETTINGS_NAV].find((item) =>
      isActive(pathname, item.href),
    ) ?? primary[0];

  const settingsActive = isActive(pathname, SETTINGS_NAV.href);
  const reportsActive = isActive(pathname, REPORTS_NAV.href);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div
          className={cn(
            GUTTER,
            "flex h-14 items-center justify-between gap-4 lg:h-16",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/today"
              className="shrink-0 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-primary lg:text-xl"
            >
              Akosile
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {current.label}
              </p>
              <p className="hidden truncate text-xs text-muted-foreground lg:block">
                {current.description}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!online && (
              <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <WifiOff className="size-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}
            <Link
              href={REPORTS_NAV.href}
              aria-label="Reports"
              aria-current={reportsActive ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-colors lg:hidden",
                reportsActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <ChartNoAxesCombined className="size-4" />
            </Link>
            <Link
              href={SETTINGS_NAV.href}
              aria-label="Settings"
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-colors",
                settingsActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Settings2 className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 flex-col border-r border-border bg-card px-4 py-5 lg:flex lg:top-16 lg:h-[calc(100dvh-4rem)]">
          <p className="mb-4 truncate px-2 text-xs text-muted-foreground">
            {profile?.name ? `${profile.name}'s day` : "Your day"}
          </p>

          <nav aria-label="Sidebar" className="flex flex-1 flex-col gap-1">
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

        <main className={cn(GUTTER, "min-w-0 flex-1 py-6 pb-24 lg:py-8 lg:pb-10")}>
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
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
  item: NavItem;
  pathname: string;
}) {
  const active = isActive(pathname, item.href);
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
  const active = isActive(pathname, item.href);
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
