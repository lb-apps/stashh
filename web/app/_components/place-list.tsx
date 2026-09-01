"use client";

import type { ExtractedPlace, RecommendationKind } from "@/lib/types";
import { formatCoords } from "@/lib/format";
import { SectionTitle } from "./section-title";
import { InstagramIcon, PinIcon, StarIcon, TagIcon } from "./icons";

const KIND_TONE: Record<RecommendationKind, string> = {
  dish: "bg-accent/12 text-accent-strong",
  drink: "bg-accent/12 text-accent-strong",
  cocktail: "bg-accent/12 text-accent-strong",
  dessert: "bg-accent/12 text-accent-strong",
  activity: "bg-success/12 text-success",
  ordering: "bg-warning/12 text-warning",
  timing: "bg-warning/12 text-warning",
  general: "bg-white/6 text-muted",
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
    <article className="surface-panel overflow-hidden rounded-2xl">
      <div className="flex gap-4 p-4">
        <Thumbnail name={place.name} url={place.thumbnail_url} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">
              {place.name}
            </h3>
            {place.rating !== null ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning/12 px-2 py-1 text-xs font-semibold text-warning">
                <StarIcon className="size-3" weight="fill" />
                {place.rating.toFixed(1)}
              </span>
            ) : null}
          </div>

          {place.address ? (
            <p className="flex items-start gap-1.5 text-[13px] leading-snug text-muted">
              <PinIcon className="mt-px size-3.5 opacity-70" />
              <span className="min-w-0">{place.address}</span>
            </p>
          ) : null}

          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
            {place.instagram_username ? (
              <span className="flex items-center gap-1.5">
                <InstagramIcon className="size-3.5 opacity-70" />@
                {place.instagram_username}
              </span>
            ) : null}
            {coords ? (
              <span className="font-mono tabular-nums">{coords}</span>
            ) : null}
          </div>

          {place.google_place_id ? (
            <p className="truncate font-mono text-[11px] text-muted">
              {place.google_place_id}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-warning">
              No Google Places match
            </p>
          )}
        </div>
      </div>

      {place.recommendations.length > 0 ? (
        <div className="flex flex-col gap-2.5 border-t border-[var(--console-hairline)] px-4 py-3.5">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <TagIcon className="size-3" />
            Creator tips
          </span>
          <ul className="flex flex-col gap-2">
            {place.recommendations.map((recommendation, index) => (
              <li className="flex items-start gap-2.5" key={index}>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                    KIND_TONE[recommendation.kind] ?? KIND_TONE.general
                  }`}
                >
                  {recommendation.kind}
                </span>
                <span className="text-[13px] leading-snug">
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
        className="flex size-[88px] shrink-0 items-center justify-center rounded-xl bg-white/4 text-muted/40"
      >
        <PinIcon className="size-6" />
      </div>
    );
  }

  return (
    // Plain <img>: thumbnails are arbitrary Supabase storage URLs and this is an
    // internal dev console — not worth coupling next.config to a bucket host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={name}
      className="size-[88px] shrink-0 rounded-xl object-cover ring-1 ring-[var(--console-hairline)]"
      height={88}
      loading="lazy"
      src={url}
      width={88}
    />
  );
}
