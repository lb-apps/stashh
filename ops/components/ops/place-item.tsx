import { ExternalLink, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatRating } from "@/lib/format";
import type { RecognitionPlace } from "@/lib/ops-types";
import { Thumb } from "./recognition-thumb";

/** A found place as a sunken row: photo, name, rating, where it is, what to order. */
export function PlaceItem({ place }: { place: RecognitionPlace }) {
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
