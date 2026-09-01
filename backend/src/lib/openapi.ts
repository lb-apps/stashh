import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ── Security ──────────────────────────────────────────────────────────────────

registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Supabase JWT access token",
});

// ── Reusable envelope schemas ─────────────────────────────────────────────────

/** Pagination query (`limit`, `cursor`) and `meta.pagination` are documented on operations with `x-pagination`. */

const apiPaginationMetaSchema = z
  .object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  })
  .openapi("ApiPaginationMeta");

const apiMetaSchema = z
  .object({
    request_id: z.string().uuid(),
    pagination: apiPaginationMetaSchema.nullable(),
  })
  .openapi("ApiMeta");

const apiErrorBodySchema = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().nullable(),
  })
  .openapi("ApiErrorBody");

const errorEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    data: z.null(),
    meta: apiMetaSchema,
    error: apiErrorBodySchema,
  })
  .openapi("ErrorResponse");

export function successEnvelope<T extends z.ZodTypeAny>(dataSchema: T, name: string) {
  return z
    .object({
      ok: z.literal(true),
      data: dataSchema,
      meta: apiMetaSchema,
      error: z.null(),
    })
    .openapi(`${name}Response`);
}

// ── Common error responses ────────────────────────────────────────────────────

export const commonErrorResponses = {
  400: {
    description: "Validation error",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
  401: {
    description: "Unauthorized",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
  404: {
    description: "Not found",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
  500: {
    description: "Internal server error",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
} as const;

// ── Generator ─────────────────────────────────────────────────────────────────

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Stashh API",
      version: "1.0.0",
      description: "Instagram place recognition and saved places management API",
    },
    servers: [{ url: "/api/v1" }],
    security: [{ BearerAuth: [] }],
  });
}
