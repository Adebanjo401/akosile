"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useLgUp } from "@/hooks/use-lg-up";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Overlay for forms: a right sidebar on desktop, a bottom drawer on mobile.
 */
function FormPanel({
  ...props
}: React.ComponentProps<typeof Sheet>) {
  return <Sheet data-slot="form-panel" {...props} />;
}

function FormPanelTrigger({
  ...props
}: React.ComponentProps<typeof SheetTrigger>) {
  return <SheetTrigger data-slot="form-panel-trigger" {...props} />;
}

function FormPanelClose({
  ...props
}: React.ComponentProps<typeof SheetClose>) {
  return <SheetClose data-slot="form-panel-close" {...props} />;
}

function FormPanelContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetContent>) {
  const isDesktop = useLgUp();

  return (
    <SheetContent
      {...props}
      side={isDesktop ? "right" : "bottom"}
      showCloseButton
      className={cn(
        "gap-0 overflow-hidden bg-background p-0",
        isDesktop
          ? "h-dvh !w-full !max-w-md border-border sm:!max-w-md"
          : "max-h-[94dvh] !w-full rounded-t-3xl border-border pb-[env(safe-area-inset-bottom)] sm:!max-w-lg",
        className,
      )}
    >
      {!isDesktop && (
        <div className="flex justify-center pt-2" aria-hidden>
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>
      )}
      {children}
    </SheetContent>
  );
}

function FormPanelHeader({
  className,
  ...props
}: React.ComponentProps<typeof SheetHeader>) {
  return (
    <SheetHeader
      data-slot="form-panel-header"
      className={cn(
        "shrink-0 gap-1 border-b border-border px-5 pt-3 pr-14 pb-4 text-left",
        className,
      )}
      {...props}
    />
  );
}

function FormPanelTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetTitle>) {
  return (
    <SheetTitle
      className={cn(
        "font-[family-name:var(--font-display)] text-xl font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function FormPanelDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetDescription>) {
  return (
    <SheetDescription
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function FormPanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="form-panel-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5", className)}
      {...props}
    />
  );
}

function FormPanelFooter({
  className,
  ...props
}: React.ComponentProps<typeof SheetFooter>) {
  return (
    <SheetFooter
      data-slot="form-panel-footer"
      className={cn(
        "mt-0 shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-5 py-4 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto",
        className,
      )}
      {...props}
    />
  );
}

export {
  FormPanel,
  FormPanelBody,
  FormPanelClose,
  FormPanelContent,
  FormPanelDescription,
  FormPanelFooter,
  FormPanelHeader,
  FormPanelTitle,
  FormPanelTrigger,
};
