import { z } from "zod";
import { commonErrorResponses, recognitionQuotaResponse, registry, successEnvelope } from "../../lib/openapi.js";
import {
  channelIdentityParamsSchema,
  channelProfileSchema,
  channelProviderSchema,
  resolveChannelIdentityBodySchema,
  staleChannelIdentitiesQuerySchema,
} from "../identities/types.js";
import { recognitionEnqueuedSchema, recognitionStatusSchema } from "../recognitions/openapi.js";
import { OPS_RANGES, opsQuerySchema } from "../ops/types.js";
import { createInternalRecognitionRequestSchema } from "../recognitions/types.js";
import { redeemSignInLinkBodySchema } from "../sign-in-links/types.js";

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

Idempotent and safe under concurrency: the user id is derived from \`provider\` + \`externalId\`, so repeated or simultaneous calls converge on one user. \`201\` when this call created the user, \`200\` otherwise.

Send \`profile\` when the channel has just fetched the person's public profile: it overwrites the stored username and name. Omit it to resolve only; the stored profile is left as is.`,
  request: {
    params: channelIdentityParamsSchema.openapi("ChannelIdentityParams"),
    body: { required: false, content: { "application/json": { schema: resolveChannelIdentityBodySchema.openapi("ResolveChannelIdentityBody") } } },
  },
  responses: {
    200: { description: "Existing identity", content: { "application/json": { schema: successEnvelope(channelIdentitySchema, "ResolveChannelIdentity") } } },
    201: { description: "Identity and user created", content: { "application/json": { schema: successEnvelope(channelIdentitySchema, "CreateChannelIdentity") } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "get",
  path: "/channel-identities/{provider}",
  summary: "List identities with a stale profile",
  description: `External ids whose profile was never fetched or was last fetched before \`synced_before\`, ordered by \`external_id\`. Page with \`after\` set to the last id returned; a short page is the last. The channel refreshes each one through \`PUT /channel-identities/{provider}/{externalId}/profile\`.`,
  request: { params: z.object({ provider: channelProviderSchema }), query: staleChannelIdentitiesQuerySchema },
  responses: {
    200: {
      description: "One page of stale identities",
      content: { "application/json": { schema: successEnvelope(z.object({ external_ids: z.array(z.string()) }), "StaleChannelIdentities") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "put",
  path: "/channel-identities/{provider}/{externalId}/profile",
  summary: "Refresh channel identity profile",
  description: "Overwrites the stored username and name of an existing identity with the profile the channel just fetched. Never creates an identity, so a refresh that races an erase cannot bring the person back: `404` when the identity does not exist.",
  request: {
    params: channelIdentityParamsSchema,
    body: { content: { "application/json": { schema: channelProfileSchema.openapi("ChannelProfile") } } },
  },
  responses: { 204: { description: "Profile stored" }, ...commonErrorResponses },
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

With \`source_url\`, the channel may also send the \`caption\` it received (a Reel shared in a DM carries it).
It is read in place of the page's, and when the post's media cannot be fetched the venues are read from it alone.

Everything an internal recognition finds is saved to \`userId\`'s places as soon as it completes (\`options.auto_save\`), each linked to this task as its source: a channel has no "Add places" step.

Send the channel's event id as \`Idempotency-Key\`: a repeat with the same key for the same user returns the original task instead of enqueuing a second one.`,
  request: {
    params: userParams,
    headers: z.object({ "Idempotency-Key": z.string().min(1).max(255).optional() }),
    body: { content: { "application/json": { schema: createInternalRecognitionRequestSchema } } },
  },
  responses: {
    202: { description: "Recognition enqueued (or the original, for a repeated key)", content: { "application/json": { schema: successEnvelope(recognitionEnqueuedSchema, "InternalEnqueueRecognition") } } },
    ...commonErrorResponses,
    ...recognitionQuotaResponse,
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

registry.registerPath({
  ...internal(),
  method: "post",
  path: "/users/{userId}/sign-in-links",
  summary: "Mint web sign-in link",
  description: `A personal link that signs \`userId\` in to the web app: \`<WEB_APP_URL>/a/<code>\`. The channel sends it to that person only.

The link never expires and works every time it is opened, until the user is erased; minting another does not revoke earlier ones. Only the code's SHA-256 is stored. \`404\` when the user does not exist.`,
  request: { params: userParams },
  responses: {
    201: {
      description: "Link minted",
      content: {
        "application/json": {
          schema: successEnvelope(
            z.object({ url: z.string().url() }).openapi("SignInLink"),
            "MintSignInLink",
          ),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "post",
  path: "/sign-in-links/redeem",
  summary: "Redeem web sign-in link",
  description: `Returns a fresh Supabase magic-link token for the owner of a link's \`code\`. The web app's server calls this; the browser then calls \`supabase.auth.verifyOtp({ token_hash, type: "magiclink" })\` and has a session. No PKCE, popup or mail involved, so it works inside Instagram's in-app browser.

A code can be redeemed any number of times; an unknown code, or one whose owner was erased, is \`410 SIGN_IN_LINK_INVALID\`. The token itself expires with Supabase's OTP lifetime (one hour by default), so exchange it right away.`,
  request: { body: { content: { "application/json": { schema: redeemSignInLinkBodySchema.openapi("RedeemSignInLinkBody") } } } },
  responses: {
    200: {
      description: "Token for verifyOtp",
      content: {
        "application/json": {
          schema: successEnvelope(
            z
              .object({ user_id: z.string().uuid(), token_hash: z.string(), type: z.literal("magiclink") })
              .openapi("RedeemedSignInLink"),
            "RedeemSignInLink",
          ),
        },
      },
    },
    410: { description: "Code unknown, or its owner was erased" },
    ...commonErrorResponses,
  },
});

// ── Ops: the DM assistant ───────────────────────────────────────────────────

const assistantSettingsSchema = z
  .object({
    model: z.string(),
    system_prompt: z.string().nullable(),
    default_prompt: z.string(),
    max_steps: z.number().int(),
    daily_turn_cap: z.number().int(),
    suggested_replies: z.boolean(),
    enabled: z.boolean(),
    updated_at: z.string().nullable(),
  })
  .openapi("AssistantSettings");

registry.registerPath({
  ...internal(),
  method: "get",
  path: "/ops/assistant",
  summary: "Assistant ops stats",
  description: `What the DM assistant has been doing, for the local ops dashboard: \`stats\` (\`assistant_ops_stats()\`: turns by status per bucket, cost, tokens and cache share, typical and slowest-5 % durations, tool and model mix, the previous window for trends) and \`turns\` (\`assistant_ops_list()\`: the latest 60 turns with who asked, what, and the answer).`,
  request: { query: opsQuerySchema },
  responses: {
    200: {
      description: "Assistant stats and latest turns",
      content: {
        "application/json": {
          schema: successEnvelope(
            z.object({
              range: z.enum(OPS_RANGES),
              since: z.string().datetime(),
              bucket: z.enum(["hour", "day"]),
              generated_at: z.string().datetime(),
              stats: z.record(z.unknown()),
              turns: z.array(z.record(z.unknown())),
            }),
            "InternalOpsAssistant",
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
  path: "/ops/assistant/turns/{id}",
  summary: "Assistant turn detail",
  description: "One assistant turn in full: usage, cost, the plan it sent, and the messages around it (the turn's own and the ten before). For the ops dashboard's detail view.",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "The turn", content: { "application/json": { schema: successEnvelope(z.record(z.unknown()), "InternalOpsAssistantTurn") } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "get",
  path: "/ops/assistant/settings",
  summary: "Assistant settings",
  description: "The assistant's settings as the owner set them, with the shipped default prompt beside the owner's (`system_prompt` null means the default is in use).",
  responses: {
    200: { description: "Settings", content: { "application/json": { schema: successEnvelope(assistantSettingsSchema, "InternalOpsAssistantSettings") } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  ...internal(),
  method: "put",
  path: "/ops/assistant/settings",
  summary: "Change assistant settings",
  description: "Changes one or more settings; the next turn runs with them (within 15 seconds on an instance that already read them). `system_prompt: null` returns to the shipped prompt.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              model: z.string().min(1).max(200).optional(),
              system_prompt: z.string().min(1).max(60_000).nullable().optional(),
              max_steps: z.number().int().min(1).max(12).optional(),
              daily_turn_cap: z.number().int().min(1).max(10_000).optional(),
              suggested_replies: z.boolean().optional(),
              enabled: z.boolean().optional(),
            })
            .openapi("AssistantSettingsPatch"),
        },
      },
    },
  },
  responses: {
    200: { description: "Settings after the change", content: { "application/json": { schema: successEnvelope(assistantSettingsSchema, "UpdateInternalOpsAssistantSettings") } } },
    ...commonErrorResponses,
  },
});
