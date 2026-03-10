import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-v2-md)] text-sm font-medium ring-offset-[var(--color-v2-background)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-v2-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-v2-primary)] text-[var(--color-v2-primary-foreground)] hover:bg-[var(--color-v2-primary)]/90 shadow-md shadow-[var(--color-v2-primary)]/20",
        destructive:
          "bg-[var(--color-v2-destructive)] text-[var(--color-v2-destructive-foreground)] hover:bg-[var(--color-v2-destructive)]/90 shadow-md shadow-[var(--color-v2-destructive)]/20",
        outline:
          "border border-[var(--color-v2-border)] bg-transparent hover:bg-[var(--color-v2-secondary)] hover:text-[var(--color-v2-secondary-foreground)]",
        secondary:
          "bg-[var(--color-v2-secondary)] text-[var(--color-v2-secondary-foreground)] hover:bg-[var(--color-v2-secondary)]/80",
        ghost: "hover:bg-[var(--color-v2-secondary)] hover:text-[var(--color-v2-secondary-foreground)]",
        link: "text-[var(--color-v2-primary)] underline-offset-4 hover:underline",
        glass: "v2-glass hover:bg-white/10 text-[var(--color-v2-foreground)] shadow-sm",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-[var(--radius-v2-sm)] px-4 text-xs",
        lg: "h-14 rounded-[var(--radius-v2-lg)] px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
