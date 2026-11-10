/**
 * Every product event the web sends to Mixpanel, and the properties each one
 * carries. This is the only place an event name is coined: a wrong name, or a
 * missing or extra property, is a compile error at the call site.
 *
 * Rules (docs/analytics-plan.md):
 * - snake_case, `object_action`, past tense: what happened, never a component.
 * - Fired where a person acts, from the interface they see. Writes are tracked
 *   once the server confirms them (a mutation's `onSuccess`), so one action is
 *   one event. The backend, the worker and the DM service send nothing.
 * - Booleans start with `is_`/`has_`; durations carry their unit.
 * - No personal data in properties: no usernames, note text or source URLs.
 */

/** Where a recognition was started from. */
export type RecognitionEntry = "clipboard" | "paste" | "retry";
/** Why a recognition gave nothing to save (`FailureKind` in recognize/recognition-view.ts). */
export type RecognitionFailure = "private" | "unavailable" | "unreadable" | "no_places";
/** Where a saved place's card was opened from. */
export type PlaceEntry = "map_pin" | "home" | "list" | "library" | "search";

export type EventCatalog = {
  /** The DM's Instagram button, on the landing page or a signed-out app screen. */
  instagram_cta_clicked: { surface: "landing" | "signed_out" | "invalid_link" };
  /** A DM map link signed the reader in. */
  map_link_opened: Record<string, never>;
  /** A DM map link could not sign the reader in. */
  map_link_failed: Record<string, never>;

  recognition_started: { entry: RecognitionEntry; source_platform: "instagram" | "tiktok" };
  /** The reader watched a recognition settle with places to pick from. */
  recognition_completed: { place_count: number; duration_ms: number };
  recognition_failed: { reason: RecognitionFailure };
  /** Recognised places saved to the library, and where they were filed. */
  places_saved: { place_count: number; target: "no_list" | "existing_list" | "new_list" };

  list_created: { entry: "recognition" | "place" | "empty" };
  list_viewed: { entry: "home" | "library"; place_count: number };
  place_added_to_list: Record<string, never>;

  place_viewed: { entry: PlaceEntry };
  place_visited: { is_visited: boolean };
  place_note_saved: { has_note: boolean };
  place_removed: Record<string, never>;
  directions_opened: Record<string, never>;
  source_post_opened: { surface: "place" | "results" };

  location_permission_answered: { is_granted: boolean; surface: "profile" | "home_prompt" };
  clipboard_watch_toggled: { is_enabled: boolean };
  user_signed_out: Record<string, never>;
};

export type EventName = keyof EventCatalog;
export type EventProps<N extends EventName> = EventCatalog[N];

/**
 * The events Meta also receives, under the name its Events Manager shows, to
 * build ad audiences from. An event absent from this map never leaves for Meta.
 */
export const metaEvents = {
  map_link_opened: "MapLinkOpened",
} as const satisfies Partial<Record<EventName, string>>;

export type MetaEventName = (typeof metaEvents)[keyof typeof metaEvents];
