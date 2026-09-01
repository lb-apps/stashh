import { z } from "zod";
import {
  registry,
  successEnvelope,
  commonErrorResponses,
} from "../../lib/openapi.js";
import {
  createRecognitionRequestSchema,
  recognitionIdentifierSchema,
  recognitionResultQuerySchema,
} from "./types.js";

// ── Response data schemas (documentation-only) ───────────────────────────────

const recognitionEnqueuedSchema = z
  .object({
    recognition_id: z.string().uuid(),
    status: z.string(),
    created_at: z.string().datetime(),
  })
  .openapi("RecognitionEnqueued");

const recognitionStatusSchema = z
  .object({
    recognition_id: z.string().uuid(),
    status: z.string(),
    source_url: z.string().url(),
    result_id: z.string().uuid().nullable(),
    places: z.unknown().nullable(),
    error_message: z.string().nullable(),
    retry_count: z.number().int(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("RecognitionStatus");

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
- \`pending\` — queued, not yet started
- \`processing\` — AI analysis in progress
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
  description: `Mark a completed recognition as committed, signalling that the client has processed the result (e.g. the user confirmed which places to save).

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
