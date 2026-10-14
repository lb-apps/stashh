import { Clapperboard, ImageIcon, Music2, Send, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SourceType } from "@/lib/ops-types";
import { cn } from "@/lib/utils";

export const SOURCE_ICON: Record<SourceType, LucideIcon> = {
  reel: Clapperboard,
  igtv: Clapperboard,
  post: ImageIcon,
  tiktok: Music2,
  shared_post: Send,
};

/**
 * A small square picture (a source cover, a place photo). Without one — older results,
 * video posts shared in a DM — the icon stands in, so every row still says what it was.
 */
export function Thumb({ url, icon: Icon, className }: { url: string | null; icon: LucideIcon; className?: string }) {
  return (
    <Avatar className={cn("size-10 rounded-lg after:rounded-lg", className)}>
      {url && <AvatarImage src={url} alt="" className="rounded-lg" />}
      <AvatarFallback className="rounded-lg">
        <Icon aria-hidden className="size-1/3 min-h-4 min-w-4" />
      </AvatarFallback>
    </Avatar>
  );
}

/** A source's cover at a fixed ratio, for galleries. */
export function SourceCover({
  url,
  type,
  ratio = 4 / 5,
  sizes,
  className,
}: {
  url: string | null;
  type: SourceType;
  ratio?: number;
  sizes: string;
  className?: string;
}) {
  const Icon = SOURCE_ICON[type];
  return (
    <AspectRatio ratio={ratio} className={cn("overflow-hidden rounded-lg bg-muted", className)}>
      {url ? (
        <Image src={url} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Icon aria-hidden className="size-1/4" />
        </div>
      )}
    </AspectRatio>
  );
}
