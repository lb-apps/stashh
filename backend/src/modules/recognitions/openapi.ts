import { z } from "zod";
import {
  registry,
  successEnvelope,
  commonErrorResponses,
} from "../../lib/openapi.js";
import { recognitionErrorCodes } from "./failure-reason.js";
import {
  RECOGNITION_STAGES,
  createRecognitionRequestSchema,
  listRecognitionsQuerySchema,
  recognitionIdentifierSchema,
  recognitionResultQuerySchema,
} from "./types.js";

// ── Response data schemas (documentation-only) ───────────────────────────────

export const recognitionEnqueuedSchema = z
  .object({
    recognition_id: z.string().uuid(),
    status: z.string(),
    created_at: z.string().datetime(),
  })
  .openapi("RecognitionEnqueued");

export const recognitionStatusSchema = z
  .object({
    recognition_id: z.string().uuid(),
    status: z.string(),
    stage: z
      .enum(RECOGNITION_STAGES)
      .nullable()
      .describe("The step a processing task is on: `fetching` the post → `analyzing` its media → `matching` venues to places → `saving` the result. Null while queued; the last step stays once finished."),
    source_url: z.string().url(),
    result_id: z.string().uuid().nullable(),
    places: z.unknown().nullable(),
    names_elsewhere: z
      .boolean()
      .describe("The post presents several venues whose names were not in the media and caption read — a list post seen by its cover only. With an empty `places`, ask for the post's link."),
    error_message: z.string().nullable(),
    error_code: z
      .enum(recognitionErrorCodes)
      .nullable()
      .describe("Set when `status` is `failed`: `private` (behind a private account), `temporarily_unavailable` (the media could not be fetched; sending it again later usually works) or `unreadable` (anything else). Word the reply from this; `error_message` is the precise reason, for operators."),
    retry_count: z.number().int(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("RecognitionStatus");

const recognitionSummarySchema = z
  .object({
    recognition_id: z.string().uuid(),
    status: z.string(),
    stage: z.enum(RECOGNITION_STAGES).nullable(),
    source_url: z.string().url().nullable().describe("The post's link; null for a post or story shared in a DM, which has none"),
    source_type: z.enum(["reel", "post", "story", "tiktok"]).nullable().describe("Null until the post has been read"),
    source_thumbnail_url: z.string().url().nullable().describe("The post's cover; null for a story or before the post has been read"),
    author_username: z.string().nullable().describe("The post's author, without @; null when the source does not name one"),
    result_id: z.string().uuid().nullable(),
    place_count: z.number().int().describe("Places found; 0 until completed"),
    created_at: z.string().datetime(),
    finished_at: z.string().datetime().nullable(),
  })
  .openapi("RecognitionSummary");

const recognitionCommitSchema = z
  .object({
    recognition_id: z.string().uuid(),
    status: z.string(),
    updated_at: z.string().datetime(),
  })
  .openapi("RecognitionCommit");

const recognitionResultSchema = z
  .object({
    result_id: z.string().uuid(),
    source_url: z.string(),
    video_url: z.string().nullable(),
    caption: z.string().nullable(),
    source_type: z.enum(["reel", "post", "story", "tiktok"]).nullable(),
    places: z.unknown(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("RecognitionResult");

// ── Register paths ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/recognitions",
  tags: ["Recognitions"],
  summary: "Enqueue recognition",
  description: `Submit an Instagram URL (Reel, Post, or Story) to identify places mentioned or shown in the content.

The job runs asynchronously. Use GET /recognitions/{id} to poll for completion, or subscribe to the \`recognition_tasks\` Supabase Realtime channel for push updates.

Once the job reaches \`completed\` status, the full result (extracted places, caption, video URL) is accessible via GET /recognitions/result?id={result_id} — the \`result_id\` is included in the status response.`,
  request: {
    body: {
      content: { "application/json": { schema: createRecognitionRequestSchema.openapi("CreateRecognitionRequest") } },
    },
  },
  responses: {
    202: {
      description: "Recognition enqueued",
      content: { "application/json": { schema: successEnvelope(recognitionEnqueuedSchema, "EnqueueRecognition") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/recognitions",
  tags: ["Recognitions"],
  summary: "List recognitions",
  description: `Your latest recognitions, newest first — every status, from the app and from Instagram DMs alike — with each post's cover, author and how many places it found. Powers "From your reels" and "Last pulled in".`,
  request: { query: listRecognitionsQuerySchema.openapi("ListRecognitionsQuery") },
  responses: {
    200: {
      description: "Latest recognitions",
      content: {
        "application/json": {
          schema: successEnvelope(z.object({ items: z.array(recognitionSummarySchema) }).openapi("RecognitionList"), "ListRecognitions"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/recognitions/result",
  tags: ["Recognitions"],
  summary: "Get result",
  description: `Fetch a completed recognition result by its \`result_id\` (available in the status response once the job is \`completed\`).

The \`places\` array contains each place extracted from the content. Each entry includes the place name, location, matched Google Place ID (if found), and any recommendations extracted from the post.

Fields \`video_url\`, \`caption\`, and \`source_type\` reflect the original Instagram content that was analysed; they may be \`null\` if the content was unavailable at processing time.`,
  request: {
    query: recognitionResultQuerySchema.openapi("RecognitionResultQuery"),
  },
  responses: {
    200: {
      description: "Recognition result with extracted items",
      content: { "application/json": { schema: successEnvelope(recognitionResultSchema, "GetRecognitionResult") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/recognitions/{id}",
  tags: ["Recognitions"],
  summary: "Get status",
  description: `Poll the status of a recognition job by its \`recognition_id\`.

**Status values:**
- \`queued\` — waiting for a worker
- \`processing\` — in progress; \`stage\` says which step (\`fetching\`, \`analyzing\`, \`matching\`, \`saving\`)
- \`completed\` — places extracted; \`result_id\` is set and the full result is available via \`GET /recognitions/result?id={result_id}\`
- \`failed\` — processing failed; see \`error_message\` and \`retry_count\`

The \`places\` field is a lightweight inline preview of extracted places (may differ from the full result document).`,
  request: {
    params: recognitionIdentifierSchema.openapi("RecognitionIdentifier"),
  },
  responses: {
    200: {
      description: "Recognition task details",
      content: { "application/json": { schema: successEnvelope(recognitionStatusSchema, "GetRecognition") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/recognitions/{id}/commit",
  tags: ["Recognitions"],
  summary: "Commit recognition",
  description: `Mark a completed recognition as committed, signalling that the client has processed the result. Committing saves nothing: places are saved with \`POST /places\` (\`source: "recognition"\`), or automatically for recognitions sent over Instagram DM.

Only recognitions in the \`completed\` state can be committed. Attempting to commit a \`pending\` or \`failed\` job returns **409**. Calling this endpoint more than once on the same recognition is safe — the response is idempotent.`,
  request: {
    params: recognitionIdentifierSchema,
  },
  responses: {
    200: {
      description: "Recognition committed",
      content: { "application/json": { schema: successEnvelope(recognitionCommitSchema, "CommitRecognition") } },
    },
    409: {
      description: "Recognition not in completed state",
    },
    ...commonErrorResponses,
  },
});
