import type { ApiPaginationMeta } from "../../http/types.js";

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
