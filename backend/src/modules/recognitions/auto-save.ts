import type { PlacesService } from "../places/service.js";
import type { RecognitionResultPlace } from "./service.js";
import type { RecognitionTaskOptions, RecognitionTaskRow } from "./types.js";

/**
 * Saves what a recognition found to its owner's library when the task asks for it (a
 * channel recognition has no "Add places" step). Runs before the task completes, so a
 * client that sees `completed` finds the places saved; a failure retries the task, and
 * the retry, served from the cache, saves again idempotently.
 */
export async function autoSavePlaces(
  placesService: Pick<PlacesService, "saveRecognitionPlaces">,
  recognition: Pick<RecognitionTaskRow, "id" | "owner_user_id" | "options">,
  places: RecognitionResultPlace[],
): Promise<number> {
  if (!(recognition.options as RecognitionTaskOptions | null)?.auto_save || places.length === 0) return 0;
  const results = await placesService.saveRecognitionPlaces(recognition.owner_user_id, places, recognition.id);
  return results.filter((result) => result.created).length;
}
