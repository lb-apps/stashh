import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * Discovery's inline pill badge: 20px, 11px heavy uppercase, the inner highlight. Tones
 * follow the console kit — cobalt-soft for done, amber-soft for waiting or review, grey
 * for nothing found. Discovery has no red fill, so a failure is a grey pill with a red
 * mark and ink text.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full px-2 font-heading text-nano uppercase whitespace-nowrap gloss transition-colors focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-cobalt-300 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-cobalt-500 text-white",
        secondary: "bg-grey-300 text-muted-foreground",
        outline: "bg-grey-100 text-muted-foreground",
        ghost: "bg-transparent text-muted-foreground shadow-none",
        link: "bg-transparent text-primary underline-offset-4 shadow-none hover:underline",
        success: "bg-cobalt-100 text-cobalt-600",
        info: "bg-cobalt-500 text-white",
        warning: "bg-amber-100 text-amber-ink",
        danger: "bg-grey-300 text-foreground before:size-1.5 before:rounded-full before:bg-danger before:content-['']",
        destructive: "bg-grey-300 text-foreground before:size-1.5 before:rounded-full before:bg-danger before:content-['']",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

type BadgeVariantName = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

export { Badge, badgeVariants, type BadgeVariantName }
