import type { ExtractedPlace, Recognition, RecognitionStage } from "@/lib/stashh/types";

/** A recognised place that can be saved: it matched a Google place. */
export type SaveablePlace = ExtractedPlace & { google_place_id: string };

/**
 * The places a reader can pick from. Places without a Google match have no
 * address to save, so they are left out; a venue named twice is listed once.
 */
export function saveablePlaces(recognition: Recognition | undefined): SaveablePlace[] {
  const seen = new Set<string>();
  return (recognition?.places ?? []).filter((p): p is SaveablePlace => {
    if (!p.google_place_id || seen.has(p.google_place_id)) return false;
    seen.add(p.google_place_id);
    return true;
  });
}

/** Why a recognition gave the reader nothing to save. */
export type FailureKind = "private" | "unavailable" | "unreadable" | "noPlaces";

export type Outcome = { kind: "working"; step: number } | { kind: "found" } | { kind: "failed"; reason: FailureKind };

/** The worker's stages, in order — one progress step each. */
export const STAGE_ORDER: readonly RecognitionStage[] = ["fetching", "analyzing", "matching", "saving"];

/**
 * Where a recognition stands. `step` is the index of the running stage; -1
 * while it is still queued, before the first one starts.
 */
export function recognitionOutcome(recognition: Recognition): Outcome {
  switch (recognition.status) {
    case "queued":
      return { kind: "working", step: -1 };
    case "processing":
      return { kind: "working", step: recognition.stage ? STAGE_ORDER.indexOf(recognition.stage) : 0 };
    case "completed":
    case "committed":
      return saveablePlaces(recognition).length ? { kind: "found" } : { kind: "failed", reason: "noPlaces" };
    case "failed":
      return {
        kind: "failed",
        reason: recognition.error_code === "private" ? "private" : recognition.error_code === "temporarily_unavailable" ? "unavailable" : "unreadable",
      };
    case "expired":
    case "cancelled":
      return { kind: "failed", reason: "unreadable" };
  }
}
