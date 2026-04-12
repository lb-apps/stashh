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
    items: z.unknown().nullable(),
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
    normalized_source_url: z.string(),
    items: z.unknown(),
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
  description: "Starts an async Instagram URL recognition job; poll `GET /recognitions/{id}` or subscribe via Supabase Realtime.",
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
  description: "Fetches a persisted recognition result document by query parameters (see schema).",
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
  description: "Recognition job status: pipeline progress, optional inline items, error and retry metadata.",
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
  description: "Marks a completed recognition as committed. Only completed recognitions can be committed.",
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
