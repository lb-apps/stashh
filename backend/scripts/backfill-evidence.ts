/**
 * Brings results saved before the evidence tables into them, so attribution can run over them.
 *
 * For every recognition result, oldest first:
 *   1. a transcript still only in `recognition_results.transcript` is copied to
 *      `recognition_transcripts` (the old backend kept writing there after the migration);
 *   2. its places get canonical rows (`ensureRecognitionPlaces`: a Place Details call for a place
 *      nobody saved yet) and `recognition_result_places` rows, in post order;
 *   3. it is queued for attribution unless it was queued before (`enqueue_result_attribution`
 *      skips stories and results without places).
 * Results analysed by the new backend already have all three and are skipped. Idempotent.
 *
 *   npx tsx scripts/backfill-evidence.ts --dry-run   # counts only, writes nothing
 *   npx tsx scripts/backfill-evidence.ts             # writes (migration 20261127120000 first)
 *
 * Reads the backend's environment (`.env`, or DOTENV_CONFIG_PATH); needs SUPABASE_SECRET_KEY.
 * The worker (`npm run dev` or production) runs the queued attribution jobs.
 */
import { createSupabaseServiceClient } from "../src/db/supabaseClient.js";
import { createPlacesServiceWithServiceRole } from "../src/modules/places/factory.js";
import type { RecognitionResultPlace } from "../src/modules/recognitions/service.js";
import type { Json } from "../src/types/database.js";

const dryRun = process.argv.includes("--dry-run");
const supabase = createSupabaseServiceClient();
const placesService = createPlacesServiceWithServiceRole();
const PAGE = 200;

interface ResultRow {
  id: string;
  source_type: string | null;
  places: Json;
  transcript: Json | null;
}

const counts = {
  results: 0,
  transcriptsCopied: 0,
  resultsLinked: 0,
  placesCreated: 0,
  attributionQueued: 0,
};

async function existing(table: "recognition_transcripts" | "recognition_result_places", ids: string[]): Promise<Set<string>> {
  const { data, error } = await supabase.from(table).select("result_id").in("result_id", ids);
  if (error) throw error;
  return new Set(data.map((row) => row.result_id));
}

async function queuedBefore(ids: string[]): Promise<Set<string>> {
  const { data, error } = await supabase.from("evidence_jobs").select("subject_id").eq("kind", "attribute").in("subject_id", ids);
  if (error) throw error;
  return new Set(data.map((row) => row.subject_id));
}

async function knownGooglePlaceIds(googleIds: string[]): Promise<Set<string>> {
  if (googleIds.length === 0) return new Set();
  const { data, error } = await supabase.from("places").select("google_place_id").in("google_place_id", googleIds);
  if (error) throw error;
  return new Set(data.map((row) => row.google_place_id).filter((id): id is string => Boolean(id)));
}

function placesOf(row: ResultRow): RecognitionResultPlace[] {
  if (!Array.isArray(row.places)) return [];
  return (row.places as unknown as RecognitionResultPlace[]).filter((p) => typeof p?.google_place_id === "string");
}

async function processPage(rows: ResultRow[]): Promise<void> {
  const ids = rows.map((row) => row.id);
  const [withTranscript, withPlaces, queued] = await Promise.all([
    existing("recognition_transcripts", ids),
    existing("recognition_result_places", ids),
    queuedBefore(ids),
  ]);

  for (const row of rows) {
    counts.results += 1;
    const story = row.source_type === "story";
    const old = row.transcript as { full_text?: unknown; segments?: unknown } | null;

    if (!story && !withTranscript.has(row.id) && typeof old?.full_text === "string" && old.full_text.trim()) {
      counts.transcriptsCopied += 1;
      if (!dryRun) {
        const { error } = await supabase.from("recognition_transcripts").insert({
          result_id: row.id,
          model: null,
          full_text: old.full_text,
          segments: Array.isArray(old.segments) ? (old.segments as Json) : [],
        });
        if (error) throw error;
      }
    }

    const places = placesOf(row);
    if (places.length > 0 && !withPlaces.has(row.id)) {
      counts.resultsLinked += 1;
      const known = await knownGooglePlaceIds(places.map((p) => p.google_place_id));
      counts.placesCreated += new Set(places.map((p) => p.google_place_id).filter((id) => !known.has(id))).size;
      if (!dryRun) {
        const placeIds = await placesService.ensureRecognitionPlaces(places);
        const seen = new Set<string>();
        const links = places.flatMap((place) => {
          const placeId = placeIds.get(place.google_place_id);
          if (!placeId || seen.has(placeId)) return [];
          seen.add(placeId);
          return [{ result_id: row.id, place_id: placeId, position: seen.size - 1, confidence: null }];
        });
        const { error } = await supabase.from("recognition_result_places").upsert(links, { onConflict: "result_id,place_id", ignoreDuplicates: true });
        if (error) throw error;
      }
    }
  }

  const toQueue = rows.filter((row) => !queued.has(row.id) && row.source_type !== "story" && placesOf(row).length > 0).map((row) => row.id);
  if (toQueue.length === 0) return;
  if (dryRun) {
    counts.attributionQueued += toQueue.length;
    return;
  }
  const { data, error } = await supabase.rpc("enqueue_result_attribution", { p_result_ids: toQueue });
  if (error) throw error;
  counts.attributionQueued += data ?? 0;
}

async function main(): Promise<void> {
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("recognition_results")
      .select("id, source_type, places, transcript")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    await processPage(data as ResultRow[]);
    console.log(`${counts.results} results read…`);
    if (data.length < PAGE) break;
  }
  console.log(dryRun ? "Dry run, nothing written:" : "Done:", counts);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
