import { createHash } from "node:crypto";
import type { Logger } from "../lib/logger.ts";
import type { DmEventName, DmEventProps } from "./events.ts";

/**
 * Mixpanel for the Instagram DM conversation (docs/analytics-plan.md). Events land on the same
 * user as the web's: the Supabase user id is the Mixpanel id everywhere.
 *
 * - Fire and forget: a call returns at once, never throws and never holds up a reply. A send
 *   that fails is logged with the event name and HTTP status only, never the token or the body.
 * - No geolocation. The conversation carries no IP of the person, and Mixpanel would otherwise
 *   place everyone at this server, so events and profile updates go out with the IP lookup off.
 * - `$insert_id` is derived from the message, so a repeated send of the same moment is one event.
 * - Without a token every call does nothing (local development without one, tests).
 */

/** The projects live in the EU (data residency); another host would drop the data. */
const API_HOST = "https://api-eu.mixpanel.com";
const TIMEOUT_MS = 5_000;

/** Who an event belongs to, when it happened, and what makes it unique (a message id or a user id). */
export interface EventAt {
  userId: string;
  time: Date;
  key: string;
}

/** What a new DM user's profile starts with; missing values are left out, never blanked. */
export interface DmProfile {
  name: string | null;
  instagramUsername: string | null;
  createdAt: Date;
}

export interface Analytics {
  track<N extends DmEventName>(name: N, props: DmEventProps<N>, at: EventAt): void;
  /** Names a new user's profile, the only place personal data goes. */
  setProfile(userId: string, profile: DmProfile): void;
  /** Deletes the user's profile when they erase their data ("sil"). */
  deleteProfile(userId: string): void;
  /** Waits for the sends still in flight; called on shutdown. */
  flush(): Promise<void>;
}

export class NoopAnalytics implements Analytics {
  track(): void {}
  setProfile(): void {}
  deleteProfile(): void {}
  async flush(): Promise<void> {}
}

export class HttpMixpanel implements Analytics {
  private readonly token: string;
  private readonly appEnv: string;
  private readonly log: Logger;
  private readonly fetch: typeof fetch;
  private readonly pending = new Set<Promise<void>>();

  constructor(options: { token: string; appEnv: string; log: Logger; fetch?: typeof fetch }) {
    this.token = options.token;
    this.appEnv = options.appEnv;
    this.log = options.log;
    this.fetch = options.fetch ?? fetch;
  }

  track<N extends DmEventName>(name: N, props: DmEventProps<N>, at: EventAt): void {
    this.send("/track", name, [
      {
        event: name,
        properties: {
          ...props,
          token: this.token,
          distinct_id: at.userId,
          $user_id: at.userId,
          time: at.time.getTime(),
          $insert_id: insertId(at.key, name),
          app_env: this.appEnv,
        },
      },
    ]);
  }

  setProfile(userId: string, profile: DmProfile): void {
    const fields: Record<string, string> = {};
    if (profile.name) fields.$name = profile.name;
    if (profile.instagramUsername) fields.instagram_username = profile.instagramUsername;
    // One operation per update; `$created` never overwrites the date the web sets from `/me`.
    const updates: object[] = [{ ...this.profileOf(userId), $set_once: { $created: profile.createdAt.toISOString() } }];
    if (Object.keys(fields).length > 0) updates.push({ ...this.profileOf(userId), $set: fields });
    this.send("/engage", "profile_set", updates);
  }

  deleteProfile(userId: string): void {
    this.send("/engage", "profile_deleted", [{ ...this.profileOf(userId), $delete: "" }]);
  }

  async flush(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }

  private profileOf(userId: string) {
    return { $token: this.token, $distinct_id: userId, $ip: "0" };
  }

  private send(path: "/track" | "/engage", label: string, records: object[]): void {
    const request: Promise<void> = this.post(path, label, records).finally(() => {
      this.pending.delete(request);
    });
    this.pending.add(request);
  }

  private async post(path: string, label: string, records: object[]): Promise<void> {
    try {
      const response = await this.fetch(`${API_HOST}${path}?verbose=1&ip=0`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({ data: JSON.stringify(records) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // `verbose=1` answers `{ status: 1 }`; a 200 alone does not mean the data was taken.
      const body = (await response.json().catch(() => null)) as { status?: unknown; error?: unknown } | null;
      if (!response.ok || body?.status !== 1) {
        this.log.warn({ event: label, status: response.status, error: typeof body?.error === "string" ? body.error : null }, "analytics not accepted");
      }
    } catch (error) {
      this.log.warn({ event: label, reason: error instanceof Error ? error.name : "unknown" }, "analytics not sent");
    }
  }
}

/** Mixpanel takes at most 36 letters, digits or dashes; the same key and event always give the same id. */
function insertId(key: string, event: string): string {
  return createHash("sha256").update(`${key}:${event}`).digest("hex").slice(0, 32);
}

/** The client for this instance: Mixpanel when a token is set, otherwise nothing. */
export function createAnalytics(options: { token: string | undefined; appEnv: string; log: Logger }): Analytics {
  return options.token ? new HttpMixpanel({ token: options.token, appEnv: options.appEnv, log: options.log }) : new NoopAnalytics();
}
