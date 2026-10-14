import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "sha256=";

/**
 * Verifies Meta's `X-Hub-Signature-256` header: an HMAC-SHA256 of the exact request
 * bytes, keyed with the app secret. Must run on the raw body — Meta signs an
 * escaped-unicode serialisation, so re-serialised JSON will not match.
 */
export function isValidSignature(
  rawBody: Buffer,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith(PREFIX)) return false;

  const received = Buffer.from(header.slice(PREFIX.length), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();

  // Length check first: timingSafeEqual throws on unequal lengths.
  return received.length === expected.length && timingSafeEqual(received, expected);
}
