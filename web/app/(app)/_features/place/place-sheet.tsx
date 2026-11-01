"use client";

import * as React from "react";
import { useSheetDetent } from "@/lib/discovery/components/DetentSheet";
import { usePlace, usePlacePhotos, usePlaces } from "@/lib/stashh/queries";
import type { SavedPlace } from "@/lib/stashh/types";
import { useSheetNav } from "../shell/sheet-state";
import { ActionList } from "./action-list";
import { HoursBlock } from "./hours-block";
import { NoteField } from "./note-field";
import { PhotoStrip } from "./photo-strip";
import { PlaceHeader, PlaceSummary } from "./place-header";
import { SourceBlock } from "./source-block";
import { VideoTips } from "./video-tips";

/** Photo width asked of the API: the strip's lead photo at 3× density. */
const PHOTO_MAX_W = 800;

/**
 * A saved place, in the map's sheet. It opens at peek over the map with the
 * name, facts, open state and the two actions; pulled to full it adds the
 * photos, hours, tips from the video, the source, the note, "been there" and
 * removal. A place that disappears (removed elsewhere) sends the sheet home.
 */
export function PlaceSheet({ placeId }: { placeId: string }) {
  const { home } = useSheetNav();
  const places = usePlaces();
  const place = usePlace(placeId);
  const missing = places.isSuccess && !place;

  // The library is external state: when the place leaves it, leave the place.
  React.useEffect(() => {
    if (missing) home();
  }, [missing, home]);

  if (!place) return null;
  // Keyed so another place starts fresh: its own note draft, hours collapsed.
  return <PlaceDetail key={place.id} place={place} />;
}

function PlaceDetail({ place }: { place: SavedPlace }) {
  const full = useSheetDetent() === "full";
  const { data: photoUrls } = usePlacePhotos(place, PHOTO_MAX_W);
  const photos = photoUrls?.length ? photoUrls : place.thumbnail_url ? [place.thumbnail_url] : [];

  return (
    <>
      <PlaceHeader place={place} photo={photos[0] ?? null} />
      <div style={{ padding: "var(--sp-4) var(--gutter) max(env(safe-area-inset-bottom), var(--sp-10))" }}>
        <PlaceSummary place={place} />
        {full ? (
          <>
            <PhotoStrip place={place} photos={photos} />
            <HoursBlock place={place} />
            <VideoTips place={place} />
            <SourceBlock place={place} />
            <NoteField place={place} />
            <ActionList place={place} />
          </>
        ) : null}
      </div>
    </>
  );
}
