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

export interface ChannelIdentity {
  provider: ChannelProvider;
  externalId: string;
  userId: string;
}

export interface ResolvedChannelIdentity extends ChannelIdentity {
  /** True when this call created the Stashh user. */
  created: boolean;
}
