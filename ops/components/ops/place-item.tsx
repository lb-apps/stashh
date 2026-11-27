import { ExternalLink, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatClock, formatRating } from "@/lib/format";
import { MENTION_SOURCE } from "@/lib/labels";
import type { PlaceMention, RecognitionPlace } from "@/lib/ops-types";
import { Thumb } from "./recognition-thumb";

/**
 * A found place as a sunken row: photo, name, rating, where it is, what to order and, in the run
 * detail, the parts of the reel tied to it.
 */
export function PlaceItem({ place, mentions }: { place: RecognitionPlace; mentions?: PlaceMention[] }) {
  const maps =
    place.google_maps_uri ??
    `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: place.name, query_place_id: place.google_place_id })}`;
  const meta = [place.category, place.district].filter(Boolean).join(" · ");
  return (
    <Item role="listitem" variant="muted" size="sm" className="items-start px-3.5 py-3">
      <ItemMedia>
        <Thumb url={place.thumbnail_url ?? null} icon={MapPin} className="size-12" />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="w-full font-heading text-body font-bold">
          <span className="truncate">{place.name}</span>
          {place.rating != null && (
            <Badge variant="success" className="ml-auto">
              <Star aria-hidden className="fill-current" />
              {formatRating(place.rating)}
            </Badge>
          )}
        </ItemTitle>
        {place.address && <ItemDescription className="line-clamp-1 text-caption">{place.address}</ItemDescription>}
        {meta && <span className="micro-label pt-1">{meta}</span>}
        {place.recommendations && place.recommendations.length > 0 && (
          <div className="mt-1.5 grid gap-0.5 text-caption">
            {place.recommendations.slice(0, 3).map((tip) => (
              <p key={tip.summary}>{tip.summary}</p>
            ))}
          </div>
        )}
        {mentions && mentions.length > 0 && (
          <div className="mt-2 grid gap-1.5">
            {mentions.map((mention, i) => (
              <div key={i} className="grid gap-0.5">
                <span className="micro-label">{mentionWhere(mention)}</span>
                <p className="text-caption">{mention.text || "—"}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-2">
          <Button asChild variant="outline" size="xs">
            <a href={maps} target="_blank" rel="noreferrer">
              Maps <ExternalLink aria-hidden />
            </a>
          </Button>
          {place.instagram_username && (
            <Button asChild variant="ghost" size="xs">
              <a href={`https://www.instagram.com/${encodeURIComponent(place.instagram_username)}/`} target="_blank" rel="noreferrer">
                @{place.instagram_username}
              </a>
            </Button>
          )}
        </div>
      </ItemContent>
    </Item>
  );
}

/** Where in the reel a mention sits: "Said · 0:03–0:14", "On screen · slide 2", "Caption". */
function mentionWhere(mention: PlaceMention): string {
  const label = MENTION_SOURCE[mention.source];
  if (mention.source === "speech" && mention.start_s != null && mention.end_s != null) {
    return `${label} · ${formatClock(mention.start_s)}–${formatClock(mention.end_s)}`;
  }
  if (mention.source === "on_screen") {
    if (mention.slide_index != null) return `${label} · slide ${mention.slide_index + 1}`;
    if (mention.start_s != null) return `${label} · ${formatClock(mention.start_s)}`;
  }
  return label;
}
