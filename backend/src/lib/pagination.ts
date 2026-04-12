import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import type { ApiPaginationMeta } from "../http/types.js";

extendZodWithOpenApi(z);

/** Shared query for cursor + limit pagination (opaque offset cursor, Supabase `.range`). */
export const paginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
  })
  .openapi("PaginationQuery");

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Invalid or missing cursor decodes to offset 0 (first page). */
export interface OffsetCursorPayload {
  o: number;
}

export function encodeOffsetCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset } satisfies OffsetCursorPayload), "utf8").toString(
    "base64url",
  );
}

export function decodeOffsetCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object" && "o" in parsed) {
      const o = (parsed as OffsetCursorPayload).o;
      if (typeof o === "number" && Number.isFinite(o) && o >= 0 && Number.isInteger(o)) {
        return o;
      }
    }
  } catch {
    // ignore
  }
  return 0;
}

export function buildPaginationMeta(
  limit: number,
  offset: number,
  returnedCount: number,
): ApiPaginationMeta {
  const hasMore = returnedCount > limit;
  const nextOffset = offset + limit;
  return {
    limit,
    next_cursor: hasMore ? encodeOffsetCursor(nextOffset) : null,
    has_more: hasMore,
  };
}

/** Reuse in OpenAPI operation descriptions for paginated list endpoints. */
export const PAGINATION_OPERATION_DESCRIPTION =
  "Paginated list: pass `limit` and optional `cursor` from the previous response’s `meta.pagination.next_cursor`.";
