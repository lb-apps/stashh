import { createHash } from "node:crypto";
import { config } from "../config.js";
import { createSupabaseServiceClient } from "../db/supabaseClient.js";

interface PhotoMediaResponse {
  photoUri?: string;
}

function inferExtension(contentType: string | null): string {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

/** Resolves a short-lived photo URI for a Places API photo resource name. */
export async function resolvePhotoUri(photoName: string, maxWidth = 400): Promise<string | null> {
  const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  url.searchParams.set("key", config.GOOGLE_PLACES_API_KEY);
  url.searchParams.set("maxWidthPx", String(maxWidth));
  url.searchParams.set("skipHttpRedirect", "true");

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as PhotoMediaResponse;
  return data.photoUri ?? null;
}

export async function uploadPlaceThumbnail(
  googlePlaceId: string,
  photoName: string,
): Promise<string | null> {
  const photoUri = await resolvePhotoUri(photoName, 400);
  if (!photoUri) return null;

  const photoResponse = await fetch(photoUri);
  if (!photoResponse.ok) return null;

  const contentType = photoResponse.headers.get("content-type");
  const extension = inferExtension(contentType);
  const photoBytes = new Uint8Array(await photoResponse.arrayBuffer());
  const hash = createHash("sha1").update(photoName).digest("hex").slice(0, 10);
  const objectPath = `${googlePlaceId}/${hash}.${extension}`;

  const supabase = createSupabaseServiceClient();
  const uploadResult = await supabase.storage
    .from(config.PLACE_THUMBNAILS_BUCKET)
    .upload(objectPath, photoBytes, {
      contentType: contentType ?? "image/jpeg",
      upsert: true,
      cacheControl: "604800",
    });

  if (uploadResult.error) {
    console.error(`[place-thumbnail] upload failed for ${googlePlaceId}: ${uploadResult.error.message}`);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(config.PLACE_THUMBNAILS_BUCKET).getPublicUrl(objectPath);

  return publicUrl || null;
}

