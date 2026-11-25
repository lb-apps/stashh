/**
 * The screens a link into the app may open on arrival. The value comes from a
 * URL anyone can write, so it only ever names one of these — never a path —
 * and anything else opens home. Plain module (no "use client"): the server
 * pages that read the URL check it too.
 *
 * `/app/a/<code>?next=premium` (the DM's quota reply) signs in, then opens
 * `/app?sheet=premium`.
 */
const ENTRY_SHEETS = ["premium"] as const;

export type EntrySheet = (typeof ENTRY_SHEETS)[number];

export function entrySheet(value: unknown): EntrySheet | null {
  return ENTRY_SHEETS.find((sheet) => sheet === value) ?? null;
}

/** Where the app opens for an entry: always inside `/app`. */
export function appPath(entry: EntrySheet | null): string {
  return entry ? `/app?sheet=${entry}` : "/app";
}
