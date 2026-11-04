import { instagramSource } from "./instagram.ts";
import type { HookSource, HookSourceId } from "./types.ts";

export { senderKey, type HookSlice, type HookSource, type HookSourceId } from "./types.ts";
export { instagramSource } from "./instagram.ts";

/** Every provider the relay forwards, by the `<source>` in `hooks.stashh.me/meta/<source>`. */
export const HOOK_SOURCES: Record<HookSourceId, HookSource> = {
  instagram: instagramSource,
};

export function hookSource(id: string): HookSource | null {
  return Object.hasOwn(HOOK_SOURCES, id) ? HOOK_SOURCES[id as HookSourceId] : null;
}
