/**
 * What a downloaded file is. CDNs do not always say — Instagram's video CDN answers
 * `application/octet-stream` — so a specific Content-Type wins and the file signature
 * decides otherwise.
 */

function sniffMimeType(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(4, 8) === "ftyp") return "video/mp4";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => bytes[i] === byte)) return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** The file's MIME type when it is a video or an image; null for anything else. */
export function detectMediaType(contentType: string | null, bytes: Uint8Array): string | null {
  const declared = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared.startsWith("video/") || declared.startsWith("image/")) return declared;
  return sniffMimeType(bytes);
}
