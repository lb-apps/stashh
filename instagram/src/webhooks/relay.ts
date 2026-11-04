import type { InboundAttachment } from "../conversation/events.ts";
import { parseCommand, type CommandOutcome } from "./core/commands.ts";
import type { RelayEnvelope } from "./core/envelope.ts";
import type { Environment } from "./core/environments.ts";

/**
 * The hooks relay (`hooks.stashh.me`, `workers/hooks`), on this service's side. The relay decides
 * where a sender routes; the instance that receives a delivery stores it, answers a `/env` command
 * in the chat, and — outside production — writes only to senders the relay routed to it.
 * Guide: docs/webhook-relay.md.
 */

/** This instance's environment, in the relay's words: the production container is `prod`, anything else `dev`. */
export function instanceEnvironment(nodeEnv: string): Environment {
  return nodeEnv === "production" ? "prod" : "dev";
}

/**
 * The command this message is, according to the relay — or null for an ordinary message. Only an
 * envelope can make a message a command: a `/env` that arrived straight from Meta (a rollback) is
 * text. A share whose caption reads like a command is a share, as the relay reads it too.
 */
export function relayCommandOf(
  message: { text: string | null; attachments: InboundAttachment[] },
  envelope: RelayEnvelope | null,
): CommandOutcome | null {
  const command = envelope?.command;
  if (!command || message.attachments.length > 0) return null;
  return parseCommand(message.text) ? command : null;
}

/**
 * Whether the relay routed this delivery to this very instance. Only then may an instance outside
 * production write to its sender: a relay pointed at the wrong host must not open a door here.
 */
export function routedHere(envelope: RelayEnvelope | null, environment: Environment): boolean {
  return envelope !== null && envelope.env === environment;
}
