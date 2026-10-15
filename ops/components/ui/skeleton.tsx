import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-tile bg-bone-200", className)}
      {...props}
    />
  )
}

export { Skeleton }
