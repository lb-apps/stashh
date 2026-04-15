import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IGooglePhotoMediaClient } from "../services/google/google-photo-media-client.js";
import type { Logger } from "./logger.js";

function inferExtension(contentType: string | null): string {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

export async function uploadPlaceThumbnail(
  googlePlaceId: string,
  photoName: string,
  bucket: string,
  supabase: SupabaseClient,
  photoMediaClient: IGooglePhotoMediaClient,
  log?: Logger,
): Promise<string | null> {
  const photoUri = await photoMediaClient.resolvePhotoUri(photoName, 400);
  if (!photoUri) {
    log?.warn({ googlePlaceId }, "could not resolve photo URI");
    return null;
  }

  const photoResponse = await fetch(photoUri);
  if (!photoResponse.ok) {
    log?.warn({ googlePlaceId, status: photoResponse.status }, "photo download failed");
    return null;
  }

  const contentType = photoResponse.headers.get("content-type");
  const extension = inferExtension(contentType);
  const photoBytes = new Uint8Array(await photoResponse.arrayBuffer());
  const hash = createHash("sha1").update(photoName).digest("hex").slice(0, 10);
  const objectPath = `${googlePlaceId}/${hash}.${extension}`;

  const uploadResult = await supabase.storage
    .from(bucket)
    .upload(objectPath, photoBytes, {
      contentType: contentType ?? "image/jpeg",
      upsert: true,
      cacheControl: "604800",
    });

  if (uploadResult.error) {
    log?.warn({ googlePlaceId, err: uploadResult.error.message }, "upload failed");
    return null;
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return publicUrl || null;
}
