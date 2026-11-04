import type { Environment } from "../webhooks/core/environments.ts";

/**
 * How far this instance may write to people on Instagram:
 *
 *   live    anyone (always, in production)
 *   routed  only senders the hooks relay routed here — team members who sent `/env dev`. The
 *           default outside production, so a dev instance can never answer a real user, even
 *           though it shares the database and the Instagram account with production.
 *   off     no one
 *
 * `META_OUTBOUND` picks the mode outside production; an unknown value means `off`, never `live`.
 * Without the relay in front (Meta's callback pointed straight at a dev tunnel), set
 * `META_OUTBOUND=live` to test locally.
 */
export type OutboundMode = "live" | "routed" | "off";

export function outboundMode(environment: Environment, setting: string | undefined): OutboundMode {
  if (environment === "prod") return "live";
  const value = setting?.trim();
  if (!value) return "routed";
  return value === "live" || value === "routed" || value === "off" ? value : "off";
}

/**
 * Whether this message's sender may be written to: one decision, asked before a message is worked
 * on at all, so a blocked one costs no recognition and every reply, typing indicator and apology
 * stays behind it.
 */
export function mayMessage(mode: OutboundMode, message: { relayRouted: boolean }): boolean {
  if (mode === "live") return true;
  if (mode === "off") return false;
  return message.relayRouted;
}

export const OUTBOUND_BLOCKED = "not answered: outside production only senders the hooks relay routed here are written to (META_OUTBOUND)";
