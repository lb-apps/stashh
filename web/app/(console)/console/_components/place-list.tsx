"use client";

import type { ComponentProps } from "react";
import { Badge, Icon } from "@/lib/discovery";
import type { ExtractedPlace, RecommendationKind } from "@/lib/types";
import { formatCoords } from "@/lib/format";
import { SectionTitle } from "./section-title";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

const KIND_TONE: Record<RecommendationKind, BadgeTone> = {
  dish: "cobaltSoft",
  drink: "cobaltSoft",
  cocktail: "cobaltSoft",
  dessert: "cobaltSoft",
  activity: "cobaltSoft",
  ordering: "amberSoft",
  timing: "amberSoft",
  general: "grey",
};

/** Stagger caps out so a long list never feels like it is loading slowly. */
const STAGGER_STEP_MS = 60;
const STAGGER_CAP_MS = 300;

export function PlaceList({ places }: { places: ExtractedPlace[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle trailing={`${places.length} extracted`}>Places</SectionTitle>

      <ul className="flex flex-col gap-3">
        {places.map((place, index) => (
          <li
            className="animate-enter-rise"
            key={place.google_place_id ?? `${place.name}-${index}`}
            style={{
              animationDelay: `${Math.min(index * STAGGER_STEP_MS, STAGGER_CAP_MS)}ms`,
            }}
          >
            <PlaceCard place={place} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlaceCard({ place }: { place: ExtractedPlace }) {
  const coords = formatCoords(place.location);

  return (
    <article className="surface-panel overflow-hidden">
      <div className="flex gap-4 p-4">
        <Thumbnail name={place.name} url={place.thumbnail_url} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="ds-headline">
              {place.name}
            </h3>
            {place.rating !== null ? (
              <Badge style={{ gap: 4, flexShrink: 0 }} tone="amberSoft">
                <Icon fill="currentColor" name="star" size={11} />
                {place.rating.toFixed(1)}
              </Badge>
            ) : null}
          </div>

          {place.address ? (
            <p className="flex items-start gap-1.5 text-caption text-grey-800">
              <Icon className="mt-0.5" name="map-pin" size={14} />
              <span className="min-w-0">{place.address}</span>
            </p>
          ) : null}

          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-micro text-grey-800">
            {place.instagram_username ? (
              <span className="flex items-center gap-1.5">
                <Icon name="at-sign" size={13} />
                {place.instagram_username}
              </span>
            ) : null}
            {coords ? (
              <span className="font-mono tabular-nums">{coords}</span>
            ) : null}
          </div>

          {place.google_place_id ? (
            <p className="truncate font-mono text-nano text-grey-800">
              {place.google_place_id}
            </p>
          ) : (
            <Badge style={{ alignSelf: "flex-start" }} tone="amberSoft">
              No Google Places match
            </Badge>
          )}
        </div>
      </div>

      {place.recommendations.length > 0 ? (
        <div className="flex flex-col gap-2.5 border-t border-grey-200 px-4 py-3.5">
          <span className="flex items-center gap-1.5 text-micro font-semibold text-grey-800">
            <Icon name="tag" size={12} />
            Creator tips
          </span>
          <ul className="flex flex-col gap-2">
            {place.recommendations.map((recommendation, index) => (
              <li className="flex items-start gap-2.5" key={index}>
                <Badge
                  style={{ flexShrink: 0 }}
                  tone={KIND_TONE[recommendation.kind] ?? KIND_TONE.general}
                >
                  {recommendation.kind}
                </Badge>
                <span className="text-caption">
                  {recommendation.summary}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function Thumbnail({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return (
      <div
        aria-hidden
        className="flex size-22 shrink-0 items-center justify-center rounded-sm bg-grey-100 text-grey-500"
      >
        <Icon name="map-pin" size={24} />
      </div>
    );
  }

  return (
    // Plain <img>: thumbnails are arbitrary Supabase storage URLs and this is an
    // internal dev console — not worth coupling next.config to a bucket host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={name}
      className="size-22 shrink-0 rounded-sm object-cover"
      height={88}
      loading="lazy"
      src={url}
      width={88}
    />
  );
}
