import { z } from "zod";
import type { Db } from "../db/client.ts";
import type { InstagramAccountRow } from "../db/types.ts";
import type { Logger } from "../lib/logger.ts";
import type { AccessTokenSource } from "./graph-client.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Refresh when fewer than this many days remain; a daily check leaves ample margin. */
const REFRESH_WITHIN_MS = 30 * DAY_MS;
/** Meta refuses to refresh a token younger than 24 hours. */
const MIN_TOKEN_AGE_MS = DAY_MS;
/** Re-read the row now and then so a refresh by another instance is picked up. */
const CACHE_TTL_MS = 10 * 60 * 1000;

const refreshResponseSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive() });

export interface TokenTimestamps {
  expiresAt: Date | null;
  /** When the current token was issued, as far as we know: last refresh, else when we stored it. */
  issuedAt: Date;
}

/** Whether a long-lived token should be refreshed now (https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token). */
export function isRefreshDue({ expiresAt, issuedAt }: TokenTimestamps, now: Date): boolean {
  if (now.getTime() - issuedAt.getTime() < MIN_TOKEN_AGE_MS) return false;
  // Unknown expiry (a bootstrapped token): refreshing is how we learn it.
  if (!expiresAt) return true;
  return expiresAt.getTime() - now.getTime() < REFRESH_WITHIN_MS;
}

/**
 * The account's Instagram Login token, kept in `instagram_accounts` because it must be
 * refreshed every 60 days and an environment variable cannot be rewritten at runtime.
 * On first run the row is seeded from `INSTAGRAM_ACCESS_TOKEN`.
 */
export class InstagramTokenStore implements AccessTokenSource {
  private readonly db: Db;
  private readonly accountId: string;
  private readonly bootstrapToken: string | undefined;
  private readonly graphBaseUrl: string;
  private readonly log: Logger;
  private readonly now: () => Date;
  private cached: { token: string; loadedAt: number } | null = null;

  constructor(options: {
    db: Db;
    accountId: string;
    bootstrapToken?: string;
    graphBaseUrl?: string;
    log: Logger;
    now?: () => Date;
  }) {
    this.db = options.db;
    this.accountId = options.accountId;
    this.bootstrapToken = options.bootstrapToken;
    this.graphBaseUrl = options.graphBaseUrl ?? "https://graph.instagram.com";
    this.log = options.log;
    this.now = options.now ?? (() => new Date());
  }

  async accessToken(): Promise<string> {
    if (this.cached && this.now().getTime() - this.cached.loadedAt < CACHE_TTL_MS) return this.cached.token;
    const row = await this.load();
    this.cached = { token: row.access_token, loadedAt: this.now().getTime() };
    return row.access_token;
  }

  /** Refreshes the token when it is due. Failures are logged and retried on the next call. */
  async refreshIfDue(): Promise<void> {
    const row = await this.load();
    const now = this.now();
    const timestamps = {
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      issuedAt: new Date(row.refreshed_at ?? row.created_at),
    };
    if (!isRefreshDue(timestamps, now)) return;

    const url = new URL(`${this.graphBaseUrl}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", row.access_token);

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      this.log.warn({ err: error }, "instagram token refresh unreachable; will retry");
      return;
    }
    const parsed = refreshResponseSchema.safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success) {
      this.log.error({ status: response.status, expiresAt: row.expires_at }, "instagram token refresh failed; will retry");
      return;
    }

    const expiresAt = new Date(now.getTime() + parsed.data.expires_in * 1000);
    const { error } = await this.db
      .from("instagram_accounts")
      .update({ access_token: parsed.data.access_token, expires_at: expiresAt.toISOString(), refreshed_at: now.toISOString() })
      .eq("account_id", this.accountId);
    if (error) throw new Error(`instagram_accounts update failed: ${error.message}`);

    this.cached = { token: parsed.data.access_token, loadedAt: now.getTime() };
    this.log.info({ expiresAt }, "instagram token refreshed");
  }

  private async load(): Promise<InstagramAccountRow> {
    const { data, error } = await this.db
      .from("instagram_accounts")
      .select("*")
      .eq("account_id", this.accountId)
      .maybeSingle();
    if (error) throw new Error(`instagram_accounts read failed: ${error.message}`);
    if (data) return data;

    if (!this.bootstrapToken) {
      throw new Error(`No access token for Instagram account ${this.accountId}: set INSTAGRAM_ACCESS_TOKEN once to seed it`);
    }
    const { data: seeded, error: seedError } = await this.db
      .from("instagram_accounts")
      // A concurrent seed from another instance wins; either way the row exists afterwards.
      .upsert({ account_id: this.accountId, access_token: this.bootstrapToken }, { onConflict: "account_id", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();
    if (seedError) throw new Error(`instagram_accounts seed failed: ${seedError.message}`);
    this.log.info({ accountId: this.accountId }, "instagram token seeded from INSTAGRAM_ACCESS_TOKEN");
    return seeded ?? this.load();
  }
}
