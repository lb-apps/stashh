/**
 * A webhook provider, as the relay needs to know it: how to cut one delivery into per-sender parts
 * and put parts back together. Nothing else about the provider lives here — storing a message is
 * the channel service's own code. Pure functions over JSON, so every shape is tested with real
 * payloads.
 */

export type HookSourceId = "instagram";

/** One `entry` of a delivery, holding only one sender's events (or only events that belong to no one). */
export interface HookSlice {
  /** `<source>:<sender id>`, or null for events no sender owns (account changes and the like). */
  key: string | null;
  entry: unknown;
}

export interface HookSource {
  id: HookSourceId;
  /** Cuts a parsed delivery into slices. Null when it is not this provider's shape at all. */
  split(payload: unknown): HookSlice[] | null;
  /** The same delivery carrying only `entries`. */
  assemble(payload: unknown, entries: unknown[]): unknown;
  /** The text of each message the sender typed in this entry, in order: where chat commands are found. */
  typedTexts(entry: unknown): Array<{ index: number; text: string }>;
}

export function senderKey(source: HookSourceId, senderId: string): string {
  return `${source}:${senderId}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function str(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}
