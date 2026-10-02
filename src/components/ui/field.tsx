import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FieldProps extends React.ComponentProps<"div"> {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
}

/**
 * Labelled form row. Labels stay visible and errors sit beside the control,
 * per the Akosile interface standards.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {optional && (
          <span className="text-xs text-muted-foreground">Optional</span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
