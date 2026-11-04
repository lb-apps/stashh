import { z } from "zod";
import type { Tapped } from "../conversation/events.ts";
import type { InstagramProfile } from "../meta/graph-client.ts";

/**
 * Typed client for the Stashh backend's internal API (`/internal/v1`).
 * The channel talks to the backend only through this — never its database.
 */

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});

const channelIdentitySchema = z.object({ user_id: z.string().uuid(), created: z.boolean() });

const staleIdentitiesSchema = z.object({ external_ids: z.array(z.string()) });

const recognitionAcceptedSchema = z.object({ recognition_id: z.string().uuid(), status: z.string() });

const signInLinkSchema = z.object({ url: z.string().url() });

// ── The assistant's reply plan ──────────────────────────────────────────────
// What the backend's assistant asks the channel to send, in order. Mirrors
// backend/src/modules/assistant/types.ts.

const quickReplyPlanSchema = z.object({ title: z.string().min(1), payload: z.string().min(1) });
const buttonPlanSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("web_url"), title: z.string().min(1), url: z.string().url() }),
  z.object({ type: z.literal("postback"), title: z.string().min(1), payload: z.string().min(1) }),
]);
const cardPlanSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  image_url: z.string().url().optional(),
  url: z.string().url().optional(),
  buttons: z.array(buttonPlanSchema),
});
const planMessageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().min(1), quick_replies: z.array(quickReplyPlanSchema).optional() }),
  z.object({ kind: z.literal("button"), text: z.string().min(1), buttons: z.array(buttonPlanSchema).min(1), quick_replies: z.array(quickReplyPlanSchema).optional() }),
  z.object({ kind: z.literal("carousel"), cards: z.array(cardPlanSchema).min(1) }),
]);
const replyPlanSchema = z.object({ messages: z.array(planMessageSchema).min(1) });
export type ReplyPlan = z.infer<typeof replyPlanSchema>;
export type PlanMessage = z.infer<typeof planMessageSchema>;

/** One of the person's messages in an assistant turn; several when quick follow-ups were folded in. */
export interface TurnMessage {
  /** The Instagram mid; the backend replays the same plan for a repeat. */
  externalId: string;
  text: string;
  tapped?: Tapped | null;
}

/** The assistant may take several model calls; the channel waits this long for the whole turn. */
const ASSISTANT_TURN_TIMEOUT_MS = 60_000;

export const placeSchema = z.object({
  google_place_id: z.string(),
  name: z.string(),
  address: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  instagram_username: z.string().nullable().optional(),
  recommendations: z.array(z.object({ summary: z.string(), kind: z.string() })).optional().default([]),
});
export type Place = z.infer<typeof placeSchema>;

const recognitionSchema = z.object({
  recognition_id: z.string().uuid(),
  status: z.enum(["queued", "processing", "completed", "committed", "failed", "cancelled", "expired"]),
  places: z.array(placeSchema).nullable(),
  /** The post announced venues whose names were not in what was read: a list seen by its cover only. */
  names_elsewhere: z.boolean().optional().default(false),
  error_message: z.string().nullable(),
  /** Why it failed, for the reply's wording; a code this build does not know reads as null. */
  error_code: z.enum(["private", "temporarily_unavailable", "unreadable"]).nullable().optional().catch(null).default(null),
});
export type Recognition = z.infer<typeof recognitionSchema>;

export const TERMINAL_STATUSES: ReadonlySet<Recognition["status"]> = new Set([
  "completed",
  "committed",
  "failed",
  "cancelled",
  "expired",
]);

/**
 * What to recognize: a link the backend scrapes, or media shared in a DM that has no
 * permalink — a feed post (with its caption) or a story (no caption; Meta forbids
 * keeping its media, so only the CDN link travels). A shared Reel is a link that also
 * carries its caption: the backend reads the venues from it when the video is withheld.
 */
export type RecognitionSource =
  | { kind: "url"; url: string; caption?: string | null }
  | { kind: "instagram_media"; format: "post" | "story"; mediaId: string; mediaUrl: string; caption: string | null };

export class StashhApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "StashhApiError";
    this.status = status;
    this.code = code;
  }

  /** 5xx, 429 and network failures are worth retrying; 4xx are not. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export interface StashhApi {
  /** Resolves (or creates) the user; a `profile` overwrites the stored username and name. */
  resolveInstagramUser(igsid: string, profile?: InstagramProfile | null): Promise<{ userId: string }>;
  /** Refreshes an existing user's profile; false when the user no longer exists (never creates one). */
  updateInstagramProfile(igsid: string, profile: InstagramProfile): Promise<boolean>;
  /** One page of senders whose profile is missing or was last fetched before `syncedBefore`. */
  listProfileStaleInstagramUsers(params: { syncedBefore: Date; after?: string; limit: number }): Promise<string[]>;
  eraseInstagramUser(igsid: string): Promise<void>;
  createRecognition(params: { userId: string; source: RecognitionSource; idempotencyKey: string }): Promise<{ recognitionId: string }>;
  getRecognition(params: { userId: string; recognitionId: string }): Promise<Recognition>;
  /** A personal link that signs the user in to the web app, for good; for their DM only. */
  mintSignInLink(userId: string): Promise<{ url: string }>;
  /** One conversational turn for the user: the assistant answers and acts on their account. */
  assistantTurn(params: { userId: string; messages: TurnMessage[] }): Promise<ReplyPlan>;
}

export class HttpStashhApi implements StashhApi {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(options: { baseUrl: string; token: string; timeoutMs?: number }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async resolveInstagramUser(igsid: string, profile?: InstagramProfile | null) {
    const data = await this.request("PUT", `/internal/v1/channel-identities/instagram/${encodeURIComponent(igsid)}`, channelIdentitySchema, {
      body: profile ? { profile } : {},
    });
    return { userId: data.user_id };
  }

  async updateInstagramProfile(igsid: string, profile: InstagramProfile) {
    try {
      await this.request("PUT", `/internal/v1/channel-identities/instagram/${encodeURIComponent(igsid)}/profile`, null, { body: profile });
      return true;
    } catch (error) {
      if (error instanceof StashhApiError && error.status === 404) return false;
      throw error;
    }
  }

  async listProfileStaleInstagramUsers({ syncedBefore, after, limit }: { syncedBefore: Date; after?: string; limit: number }) {
    const query = new URLSearchParams({ synced_before: syncedBefore.toISOString(), limit: String(limit) });
    if (after !== undefined) query.set("after", after);
    const data = await this.request("GET", `/internal/v1/channel-identities/instagram?${query}`, staleIdentitiesSchema);
    return data.external_ids;
  }

  async eraseInstagramUser(igsid: string) {
    await this.request("DELETE", `/internal/v1/channel-identities/instagram/${encodeURIComponent(igsid)}`, null);
  }

  async createRecognition({ userId, source, idempotencyKey }: { userId: string; source: RecognitionSource; idempotencyKey: string }) {
    const body =
      source.kind === "url"
        ? { source_url: source.url, ...(source.caption ? { caption: source.caption } : {}) }
        : { shared_media: { provider: "instagram", format: source.format, media_id: source.mediaId, media_url: source.mediaUrl, caption: source.caption } };
    const data = await this.request("POST", `/internal/v1/users/${userId}/recognitions`, recognitionAcceptedSchema, {
      body,
      headers: { "idempotency-key": idempotencyKey },
    });
    return { recognitionId: data.recognition_id };
  }

  async getRecognition({ userId, recognitionId }: { userId: string; recognitionId: string }) {
    return this.request("GET", `/internal/v1/users/${userId}/recognitions/${recognitionId}`, recognitionSchema);
  }

  async mintSignInLink(userId: string) {
    const data = await this.request("POST", `/internal/v1/users/${userId}/sign-in-links`, signInLinkSchema, { body: {} });
    return { url: data.url };
  }

  async assistantTurn({ userId, messages }: { userId: string; messages: TurnMessage[] }) {
    return this.request("POST", `/internal/v1/users/${userId}/assistant/turns`, replyPlanSchema, {
      body: {
        channel: "instagram",
        messages: messages.map((m) => ({ external_id: m.externalId, text: m.text, tapped: m.tapped ?? null })),
      },
      timeoutMs: ASSISTANT_TURN_TIMEOUT_MS,
    });
  }

  private async request<T extends z.ZodType>(
    method: string,
    path: string,
    schema: T | null,
    options: { body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {},
  ): Promise<z.infer<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
      });
    } catch (error) {
      throw new StashhApiError(0, null, `Stashh API unreachable: ${(error as Error).message}`);
    }

    if (response.status === 204 || schema === null) {
      if (!response.ok) throw new StashhApiError(response.status, null, `Stashh API ${method} ${path} → ${response.status}`);
      return undefined as z.infer<T>;
    }

    const parsed = envelopeSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new StashhApiError(response.status, null, `Stashh API ${method} ${path} → unexpected body (${response.status})`);
    }
    if (!response.ok || !parsed.data.ok) {
      throw new StashhApiError(response.status, parsed.data.error?.code ?? null, parsed.data.error?.message ?? `HTTP ${response.status}`);
    }
    const data = schema.safeParse(parsed.data.data);
    if (!data.success) {
      throw new StashhApiError(response.status, null, `Stashh API ${method} ${path} → data does not match contract`);
    }
    return data.data;
  }
}
