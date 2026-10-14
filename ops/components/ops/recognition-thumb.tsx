import { Clapperboard, ImageIcon, Music2, Send } from "lucide-react";
import Image from "next/image";
import type { SourceType } from "@/lib/ops-types";
import { cn } from "@/lib/utils";

const FALLBACK = { reel: Clapperboard, igtv: Clapperboard, post: ImageIcon, tiktok: Music2, shared_post: Send } as const;

/**
 * The source's cover from Storage; without one (older results, video posts shared in a DM)
 * an icon for the source type stands in, so every row still says what it was.
 */
export function RecognitionThumb({
  url,
  type,
  className,
  sizes = "64px",
}: {
  url: string | null;
  type: SourceType;
  className?: string;
  sizes?: string;
}) {
  const Icon = FALLBACK[type];
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-lg bg-muted", className)}>
      {url ? (
        <Image src={url} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Icon aria-hidden className="size-1/3 min-h-4 min-w-4" />
        </div>
      )}
    </div>
  );
}
