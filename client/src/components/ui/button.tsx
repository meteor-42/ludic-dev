import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-semibold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white border-2 border-black hover:bg-neutral-800 active:bg-neutral-900",
        destructive:
          "bg-black text-white border-2 border-black hover:bg-neutral-800",
        outline:
          "bg-white text-black border-2 border-black hover:bg-neutral-100 active:bg-neutral-200",
        secondary: "bg-neutral-200 text-black border-2 border-black hover:bg-neutral-300",
        ghost: "border-2 border-transparent hover:bg-neutral-100",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-8 px-3 text-xs",
        lg: "min-h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
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
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
