import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-[var(--akosile-primary-dark)]",
        accent:
          "bg-accent text-accent-foreground shadow-sm shadow-accent/25 hover:bg-accent/90",
        outline:
          "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        destructive:
          "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
        link: "rounded-md text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5 text-sm",
        sm: "h-9 gap-1.5 px-4 text-[0.8rem]",
        xs: "h-8 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
