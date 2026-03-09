import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useDensity } from "../hooks/use-density"
import type { DensityMode } from "../theme/ThemeProvider"

const inputVariants = cva(
  [
    "flex w-full rounded-md border border-input bg-background px-3 py-2",
    "ring-offset-background",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      density: {
        compact: "h-8 text-sm",        // 32px
        comfortable: "h-10 text-sm",   // 40px
        spacious: "h-12 text-base",    // 48px
      },
    },
    defaultVariants: {
      density: "compact",
    },
  }
)

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {
  /** Height density level. Falls back to ThemeProvider context, then 'compact'. */
  density?: DensityMode;
}

function Input({ className, type, density: densityProp, ref, ...props }: InputProps) {
  const density = useDensity(densityProp);
  return (
    <input
      type={type}
      className={cn(inputVariants({ density }), className)}
      ref={ref}
      {...props}
    />
  )
}

export { Input, inputVariants }
