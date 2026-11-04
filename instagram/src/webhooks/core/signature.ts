/**
 * HMAC-SHA256 the way Meta signs a webhook: `X-Hub-Signature-256: sha256=<hex>` over the raw body,
 * keyed by the app secret. WebCrypto, so the hooks Worker and this service check and sign alike.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validating-payloads
 */

const encoder = new TextEncoder();

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

export async function sha256Hex(data: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(data))));
}

export async function signMetaPayload(body: string, secret: string): Promise<string> {
  return `sha256=${await hmacHex(secret, body)}`;
}

export async function verifyMetaPayload(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  return constantTimeEqual(header, await signMetaPayload(body, secret));
}

/** An HMAC of our own (the relay envelope), hex. */
export function hmacSha256Hex(secret: string, data: string): Promise<string> {
  return hmacHex(secret, data);
}

/** Compares in time independent of where the strings differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}
