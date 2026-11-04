/**
 * The environments a webhook can be routed to. Everyone is `prod` until they send `/env dev`
 * (`commands.ts`); `dev` is the developer's Mac behind the fixed `ig-dev.stashh.me` tunnel.
 *
 * Shared by the hooks Worker (`workers/hooks`) and this service: relative imports and web APIs
 * only, nothing from Node.
 */

export const ENVIRONMENTS = ["dev", "prod"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

const NAMES: Record<string, Environment> = {
  dev: "dev",
  development: "dev",
  prod: "prod",
  prd: "prod",
  production: "prod",
};

/** An environment as someone typed it — `prd`, `Production` — or null when it names none. */
export function parseEnvironment(value: string | null | undefined): Environment | null {
  if (!value) return null;
  return NAMES[value.trim().toLowerCase()] ?? null;
}

export function isEnvironment(value: unknown): value is Environment {
  return typeof value === "string" && (ENVIRONMENTS as readonly string[]).includes(value);
}
