import { z } from "zod";
import { commonErrorResponses, registry, successEnvelope } from "../../lib/openapi.js";
import { channelIdentityParamsSchema } from "../identities/types.js";
import { recognitionEnqueuedSchema, recognitionStatusSchema } from "../recognitions/openapi.js";
import { OPS_RANGES, opsQuerySchema } from "../ops/types.js";
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
\`shared_media\` — a post or story shared in an Instagram DM, which has no permalink. The channel sends the
signed Instagram CDN link and, for a post, the caption it received; the task is keyed
\`instagram-media:<media_id>\` (post) or \`instagram-story:<media_id>\` (story), so the same share is served
from cache afterwards. A story's media is read but never stored.

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

registry.registerPath({
  ...internal(),
  method: "get",
  path: "/ops/recognitions",
  summary: "Recognition ops stats",
  description: `What the recognition system is doing, for the local ops dashboard.

- \`stats\`: \`recognition_ops_stats()\` — the live queue, totals for tasks created in the window, run figures
  (cache hits, p50/p95 processing, average per step, places matched, tokens and cost), p50/p95 queue wait,
  a time series (hourly for \`24h\`, daily otherwise) and failures by step. Run figures start on 2026-10-14,
  when runs began to be recorded.
- \`queue\`: tasks queued or processing now, oldest first (max 50).
- \`recognitions\`: the latest 60 recognitions with source type, channel, cover, places and cost.
- \`process\`: this instance only — uptime, memory, worker concurrency, model, API traffic since start.`,
  request: { query: opsQuerySchema },
  responses: {
    200: {
      description: "Ops snapshot",
      content: {
        "application/json": {
          schema: successEnvelope(
            z.object({
              range: z.enum(OPS_RANGES),
              since: z.string(),
              bucket: z.enum(["hour", "day"]),
              generated_at: z.string(),
              stats: z.record(z.string(), z.unknown()),
              queue: z.array(z.record(z.string(), z.unknown())),
              recognitions: z.array(z.record(z.string(), z.unknown())),
              process: z.record(z.string(), z.unknown()),
            }),
            "InternalOpsRecognitions",
          ),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "get",
  path: "/ops/recognitions/{id}",
  summary: "One recognition, in full",
  description: "Source (type, channel, caption, cover), timestamps, every worker attempt with step timings, model usage and cost, and the result places. For the ops dashboard's detail view.",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Recognition detail", content: { "application/json": { schema: successEnvelope(z.record(z.string(), z.unknown()), "InternalOpsRecognitionDetail") } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "get",
  path: "/ops/test-user-token",
  summary: "Test-user token",
  description:
    "A fresh access token for the backend's test user (`DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`), so an operator tool (the ops dashboard's link tester) can call the public API exactly as the app does. `503` when the test user is not configured.",
  responses: {
    200: {
      description: "Token",
      content: {
        "application/json": {
          schema: successEnvelope(
            z.object({ access_token: z.string(), email: z.string().email().nullable() }).openapi("InternalOpsTestUserToken"),
            "InternalOpsTestUserTokenResponse",
          ),
        },
      },
    },
    ...commonErrorResponses,
  },
});
