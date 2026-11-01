/**
 * Saves the places every past Instagram DM recognition found to its sender's library.
 *
 * Until 2026-11, DM recognitions were replied to but never saved; new ones are saved by the
 * worker (`options.auto_save`). This walks every completed or committed task of every
 * channel user, oldest first, and saves its places through the same path, so each place's
 * source is the first DM that found it. Idempotent: run it again and nothing changes.
 *
 *   npx tsx scripts/backfill-channel-saves.ts --dry-run   # counts only, writes nothing
 *   npx tsx scripts/backfill-channel-saves.ts             # saves (migrations 202611011301xx first)
 *
 * Reads the backend's environment (`.env`, or DOTENV_CONFIG_PATH); needs SUPABASE_SECRET_KEY.
 */
import { createSupabaseServiceClient } from "../src/db/supabaseClient.js";
import { createPlacesServiceWithServiceRole } from "../src/modules/places/factory.js";
import type { RecognitionResultPlace } from "../src/modules/recognitions/service.js";

const dryRun = process.argv.includes("--dry-run");
const supabase = createSupabaseServiceClient();
const PAGE = 500;

interface Task {
  id: string;
  owner_user_id: string;
  places: RecognitionResultPlace[];
}

async function channelUserIds(): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("channel_identities")
      .select("user_id")
      .order("user_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    ids.push(...data.map((row) => row.user_id));
    if (data.length < PAGE) return ids;
  }
}

/** The user's finished tasks with a result, oldest first. */
async function finishedTasks(ownerUserId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("recognition_tasks")
    .select("id, owner_user_id, recognition_results (places)")
    .eq("owner_user_id", ownerUserId)
    .in("status", ["completed", "committed"])
    .not("result_id", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as unknown as Array<{ id: string; owner_user_id: string; recognition_results: { places: unknown } | null }>).map((row) => ({
    id: row.id,
    owner_user_id: row.owner_user_id,
    places: Array.isArray(row.recognition_results?.places) ? (row.recognition_results.places as RecognitionResultPlace[]) : [],
  }));
}

/** Google place ids the user has already saved. */
async function savedGoogleIds(ownerUserId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("saved_places").select("places (google_place_id)").eq("owner_user_id", ownerUserId);
  if (error) throw error;
  const rows = data as unknown as Array<{ places: { google_place_id: string | null } | null }>;
  return new Set(rows.map((row) => row.places?.google_place_id).filter((id): id is string => Boolean(id)));
}

const totals = { users: 0, usersWithTasks: 0, tasks: 0, tasksWithPlaces: 0, places: 0, alreadySaved: 0, toSave: 0, saved: 0 };
const placesService = dryRun ? null : createPlacesServiceWithServiceRole();

for (const ownerUserId of await channelUserIds()) {
  totals.users++;
  const tasks = await finishedTasks(ownerUserId);
  if (tasks.length === 0) continue;
  totals.usersWithTasks++;
  totals.tasks += tasks.length;

  const saved = await savedGoogleIds(ownerUserId);
  const seen = new Set<string>();
  for (const task of tasks) {
    const fresh = task.places.filter((place) => !seen.has(place.google_place_id));
    fresh.forEach((place) => seen.add(place.google_place_id));
    if (task.places.length > 0) totals.tasksWithPlaces++;
    totals.places += fresh.length;
    totals.alreadySaved += fresh.filter((place) => saved.has(place.google_place_id)).length;
    const toSave = fresh.filter((place) => !saved.has(place.google_place_id));
    totals.toSave += toSave.length;

    if (placesService && toSave.length > 0) {
      const results = await placesService.saveRecognitionPlaces(ownerUserId, toSave, task.id);
      totals.saved += results.filter((result) => result.created).length;
    }
  }
}

console.log(JSON.stringify({ dry_run: dryRun, ...totals }, null, 2));
