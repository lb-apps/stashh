import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "./logger.js";
import { detectMediaType } from "./media-type.js";

export const SOURCE_THUMBNAILS_BUCKET = "source-thumbnails";

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** Object path for a source's cover: sha256 of the source key, fanned out by its first byte. */
export function sourceThumbnailPath(sourceKey: string, extension: string): string {
  const hash = createHash("sha256").update(sourceKey).digest("hex");
  return `${hash.slice(0, 2)}/${hash.slice(2)}.${extension}`;
}

type StorageClient = Pick<SupabaseClient, "storage">;

/**
 * Copies a post's cover image into the public `source-thumbnails` bucket, because the
 * platforms' CDN links expire. Best-effort: anything that is not an image, or any failure,
 * yields null and is logged — a missing cover never fails a recognition.
 */
export async function uploadSourceThumbnail(
  imageUrl: string,
  sourceKey: string,
  supabase: StorageClient,
  log: Logger,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      log.warn({ status: response.status }, "source thumbnail not fetched");
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = detectMediaType(response.headers.get("content-type"), bytes);
    if (!mimeType?.startsWith("image/")) return null;

    const path = sourceThumbnailPath(sourceKey, EXTENSIONS[mimeType] ?? "jpg");
    const bucket = supabase.storage.from(SOURCE_THUMBNAILS_BUCKET);
    const { error } = await bucket.upload(path, bytes, { contentType: mimeType, upsert: true, cacheControl: "604800" });
    if (error) {
      log.warn({ err: error.message }, "source thumbnail upload failed");
      return null;
    }
    return bucket.getPublicUrl(path).data.publicUrl || null;
  } catch (error) {
    log.warn({ err: error instanceof Error ? error.message : String(error) }, "source thumbnail failed");
    return null;
  }
}
