import type { ExtractedPlace, MatchedPlace } from "../../../types/schemas.js";
import type { SavedResultPlace } from "../repository.js";

/**
 * The places a result features, in post order, as canonical rows with the text the post shows for
 * each. Two names in one post can resolve to one listing; they become one place whose on-screen
 * text is both of theirs. Venues that matched nothing are left out: no listing, no evidence.
 */
export function buildResultPlaces(
  extracted: ExtractedPlace[],
  matches: Map<string, MatchedPlace | null>,
  placeIds: Map<string, string>,
): SavedResultPlace[] {
  const byPlace = new Map<string, SavedResultPlace>();
  for (const venue of extracted) {
    const match = matches.get(venue.name);
    const placeId = match ? placeIds.get(match.google_place_id) : undefined;
    if (!placeId) continue;
    const seen = byPlace.get(placeId);
    if (seen) {
      seen.confidence = Math.max(seen.confidence, venue.confidence_score);
      seen.on_screen.push(...venue.on_screen);
    } else {
      byPlace.set(placeId, { place_id: placeId, confidence: venue.confidence_score, on_screen: [...venue.on_screen] });
    }
  }
  return [...byPlace.values()];
}
