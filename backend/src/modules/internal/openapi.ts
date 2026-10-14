import { z } from "zod";
import { commonErrorResponses, registry, successEnvelope } from "../../lib/openapi.js";
import { channelIdentityParamsSchema } from "../identities/types.js";
import { recognitionEnqueuedSchema, recognitionStatusSchema } from "../recognitions/openapi.js";
import { createInternalRecognitionRequestSchema } from "../recognitions/types.js";

registry.registerComponent("securitySchemes", "ServiceToken", {
  type: "http",
  scheme: "bearer",
  description: "Static service token (INTERNAL_API_TOKENS). Never a user JWT.",
});

/** Shared operation fields: own server prefix and security scheme, not the public ones. */
function internal() {
  return {
    tags: ["Internal"],
    servers: [{ url: "/internal/v1" }],
    security: [{ ServiceToken: [] }],
  };
}

const channelIdentitySchema = z
  .object({
    provider: z.enum(["instagram"]),
    external_id: z.string(),
    user_id: z.string().uuid(),
    created: z.boolean(),
  })
  .openapi("ChannelIdentity");

const userParams = z.object({ userId: z.string().uuid() });

registry.registerPath({
  ...internal(),
  method: "put",
  path: "/channel-identities/{provider}/{externalId}",
  summary: "Resolve channel identity",
  description: `Returns the Stashh user behind an identity on a messaging channel, creating it on first contact.

Idempotent and safe under concurrency: the user id is derived from \`provider\` + \`externalId\`, so repeated or simultaneous calls converge on one user. \`201\` when this call created the user, \`200\` otherwise.`,
  request: { params: channelIdentityParamsSchema.openapi("ChannelIdentityParams") },
  responses: {
    200: { description: "Existing identity", content: { "application/json": { schema: successEnvelope(channelIdentitySchema, "ResolveChannelIdentity") } } },
    201: { description: "Identity and user created", content: { "application/json": { schema: successEnvelope(channelIdentitySchema, "CreateChannelIdentity") } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "delete",
  path: "/channel-identities/{provider}/{externalId}",
  summary: "Erase channel identity",
  description: "Deletes the Stashh user behind the identity and everything they own (identity mapping, recognitions, saved places, lists). Idempotent: `204` whether or not anything existed.",
  request: { params: channelIdentityParamsSchema },
  responses: { 204: { description: "Erased" }, ...commonErrorResponses },
});

registry.registerPath({
  ...internal(),
  method: "post",
  path: "/users/{userId}/recognitions",
  summary: "Enqueue recognition for a user",
  description: `Same contract as the public \`POST /recognitions\`, on behalf of \`userId\`, with one more source:
\`shared_media\` — a post shared in an Instagram DM, which has no permalink. The channel sends the
signed Instagram CDN link and the caption it received; the task is keyed \`instagram-media:<media_id>\`,
so the same post is served from cache afterwards.

Send the channel's event id as \`Idempotency-Key\`: a repeat with the same key for the same user returns the original task instead of enqueuing a second one.`,
  request: {
    params: userParams,
    headers: z.object({ "Idempotency-Key": z.string().min(1).max(255).optional() }),
    body: { content: { "application/json": { schema: createInternalRecognitionRequestSchema } } },
  },
  responses: {
    202: { description: "Recognition enqueued (or the original, for a repeated key)", content: { "application/json": { schema: successEnvelope(recognitionEnqueuedSchema, "InternalEnqueueRecognition") } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "get",
  path: "/users/{userId}/recognitions/{id}",
  summary: "Get recognition for a user",
  description: "Same shape as the public `GET /recognitions/{id}`, scoped to `userId`. Poll until `status` is terminal.",
  request: { params: userParams.extend({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Recognition task", content: { "application/json": { schema: successEnvelope(recognitionStatusSchema, "InternalGetRecognition") } } },
    ...commonErrorResponses,
  },
});
