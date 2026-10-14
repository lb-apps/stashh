import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * Discovery's button (ui_kits/web_console): rounded 16px, SF Pro semibold, a press that
 * shrinks with a spring. The primary fill is the glossy cobalt gradient; secondary is a
 * bone pill with the same inner highlight. Focus shows as an outline so it never fights
 * the fill's own shadow.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-button font-heading font-semibold tracking-[-0.012em] whitespace-nowrap transition-[transform,filter,background-color] duration-150 ease-spring outline-none select-none focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt-300 active:not-aria-[haspopup]:scale-[0.965] disabled:pointer-events-none disabled:opacity-40 aria-invalid:outline-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "fill-primary hover:brightness-110",
        outline: "bg-card text-foreground depth-float hover:bg-grey-100 aria-expanded:bg-grey-100",
        secondary: "bg-bone-300 text-foreground gloss hover:bg-bone-200 aria-expanded:bg-bone-200",
        ghost: "text-muted-foreground hover:bg-bone-300/70 hover:text-foreground aria-expanded:bg-bone-300/70",
        destructive: "bg-bone-300 text-destructive gloss hover:bg-bone-200",
        link: "rounded-none text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-12 gap-2 px-5 text-body",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 text-caption [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-[58px] gap-2.5 rounded-[20px] px-6 text-[19px]",
        icon: "size-11 rounded-full",
        "icon-xs": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-full",
        "icon-lg": "size-13 rounded-full",
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
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
