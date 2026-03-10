import * as React from "react"
import { cn } from "../utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[var(--radius-v2-md)] border border-[var(--color-v2-input)] bg-[var(--color-v2-background)] px-3 py-2 text-sm ring-offset-[var(--color-v2-background)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--color-v2-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-v2-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
