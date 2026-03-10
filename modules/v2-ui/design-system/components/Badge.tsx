import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-v2-ring)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-v2-primary)] text-[var(--color-v2-primary-foreground)] shadow-sm hover:bg-[var(--color-v2-primary)]/80",
        secondary:
          "border-transparent bg-[var(--color-v2-secondary)] text-[var(--color-v2-secondary-foreground)] hover:bg-[var(--color-v2-secondary)]/80",
        destructive:
          "border-transparent bg-[var(--color-v2-destructive)] text-[var(--color-v2-destructive-foreground)] shadow-sm hover:bg-[var(--color-v2-destructive)]/80",
        outline: "text-[var(--color-v2-foreground)] border-[var(--color-v2-border)]",
        glass: "v2-glass border-transparent text-[var(--color-v2-foreground)] shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
