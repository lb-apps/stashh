import { commandOutcomeOf, type CommandOutcome } from "./commands.ts";
import { isEnvironment, type Environment } from "./environments.ts";
import { constantTimeEqual, hmacSha256Hex, sha256Hex } from "./signature.ts";

/**
 * What the hooks relay adds to a webhook it forwards: which environment it routed the payload to,
 * and what a chat command in it did. Sealed with `HOOKS_RELAY_SECRET`, which the relay and every
 * instance share, over the exact body sent — so an instance can trust it as much as Meta's own
 * signature.
 *
 * A request without these headers came straight from Meta (no relay in front, or a rollback);
 * that is still valid, it just carries no routing.
 */
export interface RelayEnvelope {
  env: Environment;
  command: CommandOutcome | null;
}

export const RELAY_HEADERS = {
  env: "x-hooks-relay-env",
  command: "x-hooks-relay-command",
  signature: "x-hooks-relay-signature",
} as const;

/** All the envelope reads from a request: Fetch `Headers`, or an adapter over Express's `req.get`. */
export type HeaderReader = Pick<Headers, "get">;

const VERSION = "v1";

async function seal(envelope: RelayEnvelope, command: string, body: string, secret: string): Promise<string> {
  return hmacSha256Hex(secret, [VERSION, envelope.env, command, await sha256Hex(body)].join("\n"));
}

export async function sealEnvelope(envelope: RelayEnvelope, body: string, secret: string): Promise<Record<string, string>> {
  const command = envelope.command ? toBase64Url(JSON.stringify(envelope.command)) : "";
  const headers: Record<string, string> = {
    [RELAY_HEADERS.env]: envelope.env,
    [RELAY_HEADERS.signature]: await seal(envelope, command, body, secret),
  };
  if (command) headers[RELAY_HEADERS.command] = command;
  return headers;
}

/**
 * `envelope: null` — no relay headers (a direct delivery). `ok: false` — headers that do not hold:
 * the request is refused, never read as a direct delivery.
 */
export async function openEnvelope(
  headers: HeaderReader,
  body: string,
  secret: string | null | undefined,
): Promise<{ ok: true; envelope: RelayEnvelope | null } | { ok: false }> {
  const env = headers.get(RELAY_HEADERS.env);
  const signature = headers.get(RELAY_HEADERS.signature);
  const commandHeader = headers.get(RELAY_HEADERS.command) ?? "";
  if (env === null && signature === null && !commandHeader) return { ok: true, envelope: null };
  if (!secret || !signature || !isEnvironment(env)) return { ok: false };

  const command = commandHeader ? parseOutcome(commandHeader) : null;
  if (commandHeader && !command) return { ok: false };
  const envelope: RelayEnvelope = { env, command };
  const expected = await seal(envelope, commandHeader, body, secret);
  return constantTimeEqual(signature, expected) ? { ok: true, envelope } : { ok: false };
}

function parseOutcome(encoded: string): CommandOutcome | null {
  try {
    return commandOutcomeOf(JSON.parse(fromBase64Url(encoded)));
  } catch {
    return null;
  }
}

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
