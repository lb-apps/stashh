/**
 * Every product event the Instagram DM conversation sends to Mixpanel, and the properties each
 * one carries. The web app has its own catalog (`web/lib/analytics/events.ts`); a name is coined
 * in exactly one of the two, for the interface where the person acts, and
 * docs/analytics-plan.md lists both.
 *
 * Rules (docs/analytics-plan.md):
 * - snake_case, `object_action`, past tense: what the person did or got, never a code path.
 * - Sent from the moment the person lives in the conversation, once the state it reports is
 *   stored (the message settled), so one moment is one event. The backend and the recognition
 *   worker send nothing.
 * - Durations carry their unit. No personal data in properties: no link, caption, username or
 *   Instagram id. A name goes only on the profile.
 */

/** How the person handed over the post: shared from the Instagram app, or pasted as a link. */
export type RecognitionEntry = "dm_share" | "dm_link";

/** What was shared; the same words as the stored results' `source_type`. */
export type SourceType = "reel" | "post" | "story" | "tiktok";

/** Why the person got no places, in the words of the reply they got. */
export type RecognitionFailure =
  /** The post is private: Instagram showed a login page. */
  | "private"
  /** Instagram or TikTok withheld the media for now. */
  | "unavailable"
  /** The post could not be read. */
  | "unreadable"
  /** Read, but it names no place. */
  | "no_places"
  /** A list post shared from the feed shows only its cover; the reply asked for its link. */
  | "needs_link"
  /** No result within the wait (5 minutes), or the reply window closed. */
  | "timed_out"
  /** The person reached the day's number of analyses. */
  | "daily_limit"
  /** Our side failed; the person got an apology. */
  | "error";

export interface RecognitionProps {
  entry: RecognitionEntry;
  source_type: SourceType;
}

export type DmEventCatalog = {
  /** The person's first message created their Stashh account. */
  user_signed_up: Record<string, never>;
  /** The person shared a post or a link to analyse. */
  recognition_started: RecognitionProps;
  /** The places reached the person, already saved to their map. */
  recognition_completed: RecognitionProps & { place_count: number; duration_ms: number };
  /** The person got a reply without places. */
  recognition_failed: RecognitionProps & { reason: RecognitionFailure; duration_ms: number };
};

export type DmEventName = keyof DmEventCatalog;
export type DmEventProps<N extends DmEventName> = DmEventCatalog[N];
