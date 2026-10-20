import { z } from "zod";

/** Messaging channels whose users can own Stashh data. Mirrors the DB check constraint. */
export const channelProviderSchema = z.enum(["instagram"]);
export type ChannelProvider = z.infer<typeof channelProviderSchema>;

/** Path params for `/internal/v1/channel-identities/:provider/:externalId`. */
export const channelIdentityParamsSchema = z.object({
  provider: channelProviderSchema,
  // Instagram-scoped ids are numeric strings; the allowlist keeps the id safe to embed
  // in the reserved email local part and in log lines.
  externalId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "externalId must be 1–128 of [A-Za-z0-9_-]"),
});

/** The person's public profile on the channel, as the channel adapter last fetched it. */
export const channelProfileSchema = z.object({
  // Instagram's own username rules; the DB check constraint mirrors them.
  username: z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "username must be 1–30 of [A-Za-z0-9._]"),
  name: z.string().trim().min(1).max(200).nullable(),
});
export type ChannelProfile = z.infer<typeof channelProfileSchema>;

/** Body of `PUT /internal/v1/channel-identities/:provider/:externalId`; empty resolves only. */
export const resolveChannelIdentityBodySchema = z.object({ profile: channelProfileSchema.optional() });

/** Query of `GET /internal/v1/channel-identities/:provider`: identities whose profile is due a refresh. */
export const staleChannelIdentitiesQuerySchema = z.object({
  synced_before: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
  /** Keyset cursor: the last `external_id` of the previous page. */
  after: z.string().max(128).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export interface ChannelIdentity {
  provider: ChannelProvider;
  externalId: string;
  userId: string;
}

export interface ResolvedChannelIdentity extends ChannelIdentity {
  /** True when this call created the Stashh user. */
  created: boolean;
}
