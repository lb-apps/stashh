import { z } from "zod";

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

const recognitionAcceptedSchema = z.object({ recognition_id: z.string().uuid(), status: z.string() });

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
  error_message: z.string().nullable(),
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
 * keeping its media, so only the CDN link travels).
 */
export type RecognitionSource =
  | { kind: "url"; url: string }
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
  resolveInstagramUser(igsid: string): Promise<{ userId: string }>;
  eraseInstagramUser(igsid: string): Promise<void>;
  createRecognition(params: { userId: string; source: RecognitionSource; idempotencyKey: string }): Promise<{ recognitionId: string }>;
  getRecognition(params: { userId: string; recognitionId: string }): Promise<Recognition>;
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

  async resolveInstagramUser(igsid: string) {
    const data = await this.request("PUT", `/internal/v1/channel-identities/instagram/${encodeURIComponent(igsid)}`, channelIdentitySchema);
    return { userId: data.user_id };
  }

  async eraseInstagramUser(igsid: string) {
    await this.request("DELETE", `/internal/v1/channel-identities/instagram/${encodeURIComponent(igsid)}`, null);
  }

  async createRecognition({ userId, source, idempotencyKey }: { userId: string; source: RecognitionSource; idempotencyKey: string }) {
    const body =
      source.kind === "url"
        ? { source_url: source.url }
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

  private async request<T extends z.ZodType>(
    method: string,
    path: string,
    schema: T | null,
    options: { body?: unknown; headers?: Record<string, string> } = {},
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
        signal: AbortSignal.timeout(this.timeoutMs),
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
