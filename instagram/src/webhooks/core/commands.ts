import { ENVIRONMENTS, isEnvironment, parseEnvironment, type Environment } from "./environments.ts";

/**
 * The relay's chat commands. English on purpose: they are the team's, not the user's.
 *
 *   /env           which environment this account is routed to
 *   /env <name>    route this account to dev or prod (also /env=<name>, prd, development, …)
 *
 * Only a message whose whole text is one command counts; anything else is an ordinary message.
 * Any account may route itself (no registration): a non-prod instance writes only to accounts
 * the relay routed to it, so a stray `/env dev` costs that person nothing but their replies
 * until `/env prod`.
 */
export type HookCommand =
  | { kind: "env-show" }
  | { kind: "env-set"; env: Environment }
  | { kind: "env-invalid"; value: string };

const COMMAND = /^\/env(?:[=\s]+(\S+))?\s*$/i;

export function parseCommand(text: string | null | undefined): HookCommand | null {
  if (!text) return null;
  const match = COMMAND.exec(text.trim());
  if (!match) return null;
  const argument = match[1] ?? null;

  if (argument === null) return { kind: "env-show" };
  const env = parseEnvironment(argument);
  return env ? { kind: "env-set", env } : { kind: "env-invalid", value: argument };
}

/** What the relay did with a command, as the receiving instance needs it to answer. */
export type CommandOutcome =
  | { kind: "env-show"; env: Environment }
  | { kind: "env-set"; env: Environment; from: Environment }
  | { kind: "env-invalid"; env: Environment; value: string }
  /** The asked-for environment cannot take this channel right now; the account stays where it was. */
  | { kind: "env-unavailable"; env: Environment; target: Environment };

/**
 * A command outcome read back from outside — the envelope's header, a stored row — or null when
 * the value is not one. Nothing else is trusted as an outcome.
 */
export function commandOutcomeOf(value: unknown): CommandOutcome | null {
  if (typeof value !== "object" || value === null) return null;
  const outcome = value as Record<string, unknown>;
  const env = outcome["env"];
  if (!isEnvironment(env)) return null;
  switch (outcome["kind"]) {
    case "env-show":
      return { kind: "env-show", env };
    case "env-set":
      return isEnvironment(outcome["from"]) ? { kind: "env-set", env, from: outcome["from"] } : null;
    case "env-invalid":
      return typeof outcome["value"] === "string" ? { kind: "env-invalid", env, value: outcome["value"] } : null;
    case "env-unavailable":
      return isEnvironment(outcome["target"]) ? { kind: "env-unavailable", env, target: outcome["target"] } : null;
    default:
      return null;
  }
}

/** The confirmation sent back in the chat. One line, English, for the team only. */
export function commandReply(outcome: CommandOutcome): string {
  const choices = ENVIRONMENTS.map((env) => `/env ${env}`).join(", ");
  switch (outcome.kind) {
    case "env-show":
      return `This account routes to ${outcome.env}.`;
    case "env-set":
      return outcome.env === outcome.from
        ? `This account already routes to ${outcome.env}.`
        : outcome.env === "prod"
          ? "This account now routes to prod."
          : `This account now routes to ${outcome.env}. Send /env prod to go back.`;
    case "env-invalid":
      return `"${outcome.value}" is not an environment. Use ${choices}.`;
    case "env-unavailable":
      return `${outcome.target} cannot take this channel right now, so this account stays on ${outcome.env}.`;
  }
}

/**
 * The query an instance answers with 204 when it takes the relay's deliveries — how the relay
 * checks an environment before routing someone there. Says nothing but "this route exists".
 */
export const RELAY_PROBE_QUERY = "relay=probe";
