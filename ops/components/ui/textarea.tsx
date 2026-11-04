import * as React from "react";
import { cn } from "@/lib/utils";

/** The kit's field, grown for long text: a soft bone block, no border, the cobalt focus outline. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[20px] bg-bone-300 px-4 py-3 text-body gloss transition-colors outline-none placeholder:text-muted-foreground focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-cobalt-300 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:outline-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
