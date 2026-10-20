import type { Logger } from "../lib/logger.ts";
import { GraphApiError, type InstagramProfile, type ProfileReader } from "../meta/graph-client.ts";
import type { StashhApi } from "../stashh/client.ts";

/** A stored profile older than this is read again: people rename. */
export const PROFILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

export interface ProfileSweepDeps {
  stashh: StashhApi;
  profiles: ProfileReader;
  log: Logger;
  now?: () => Date;
}

/**
 * Refreshes every sender whose stored profile is missing or older than a week: the
 * backfill for people who wrote before profiles were kept, and the catch-up for renames
 * and for reads the message path missed.
 *
 * Walks the stale set once, in id order, so a sender Meta no longer answers for is tried
 * once per sweep rather than in a loop. A retryable Graph error (throttling, outage) ends
 * the sweep early; the next one resumes. Returns how many profiles were stored.
 */
export async function sweepProfiles({ stashh, profiles, log, now = () => new Date() }: ProfileSweepDeps): Promise<number> {
  const syncedBefore = new Date(now().getTime() - PROFILE_MAX_AGE_MS);
  let after: string | undefined;
  let stored = 0;

  for (;;) {
    const page = await stashh.listProfileStaleInstagramUsers({ syncedBefore, after, limit: PAGE_SIZE });
    for (const igsid of page) {
      let profile: InstagramProfile | null;
      try {
        profile = await profiles.profile(igsid);
      } catch (error) {
        if (error instanceof GraphApiError && error.retryable) {
          log.warn({ err: error, stored }, "profile sweep paused");
          return stored;
        }
        log.debug({ err: error, igsid }, "profile not available");
        continue;
      }
      if (profile && (await stashh.updateInstagramProfile(igsid, profile))) stored++;
    }
    if (page.length < PAGE_SIZE) return stored;
    after = page.at(-1);
  }
}
