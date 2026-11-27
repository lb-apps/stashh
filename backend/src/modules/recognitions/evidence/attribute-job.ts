import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "../../../lib/logger.js";
import type { Database, Json } from "../../../types/database.js";
import { attribute, buildAttributionInput, type AttributionPlace, type TextModel } from "./attribution.js";
import type { JobOutcome } from "./jobs.js";

interface AttributeJobDeps {
  db: SupabaseClient<Database>;
  model: TextModel;
  modelId: string;
}

/**
 * The `attribute` job: reads a result's transcript, caption and places, ties the parts to the
 * places and replaces the result's speech and caption mentions. A result analysed again while the
 * job ran is left alone: `replace_result_mentions` sees the transcript or caption changed and the
 * job the new analysis queued does the work.
 */
export async function runAttributeJob(resultId: string, deps: AttributeJobDeps, log: Logger): Promise<JobOutcome> {
  const { db } = deps;
  const { data: result, error: resultError } = await db
    .from("recognition_results")
    .select("id, caption, source_type")
    .eq("id", resultId)
    .maybeSingle();
  if (resultError) throw resultError;
  // Gone, or a story (Meta allows reading a story, not keeping what it says).
  if (!result || result.source_type === "story") return { model: null, usage: null };

  const [transcriptRead, placesRead] = await Promise.all([
    db.from("recognition_transcripts").select("id, segments").eq("result_id", resultId).maybeSingle(),
    db
      .from("recognition_result_places")
      .select("place_id, position, places (name, category)")
      .eq("result_id", resultId)
      .order("position"),
  ]);
  if (transcriptRead.error) throw transcriptRead.error;
  if (placesRead.error) throw placesRead.error;

  const places: AttributionPlace[] = (placesRead.data ?? []).map((row) => {
    const place = row.places as unknown as { name: string; category: string | null } | null;
    return { place_id: row.place_id, name: place?.name ?? "", category: place?.category ?? null };
  });
  const transcript = transcriptRead.data;
  const input = buildAttributionInput(places, transcript?.segments ?? [], result.caption);
  const outcome = await attribute(input, deps.model, deps.modelId);

  const { data: written, error: writeError } = await db.rpc("replace_result_mentions", {
    p_result_id: resultId,
    p_transcript_id: transcript?.id ?? null,
    p_caption_md5: createHash("md5").update(result.caption ?? "").digest("hex"),
    p_mentions: outcome.mentions as unknown as Json,
  });
  if (writeError) throw writeError;

  log.info(
    {
      places: places.length,
      segments: input.segments.length,
      lines: input.lines.length,
      mentions: outcome.mentions.length,
      dropped: outcome.dropped,
      modelCalled: outcome.model !== null,
      written,
    },
    written ? "result attributed" : "result changed while attributing; left to the newer job",
  );
  return { model: outcome.model, usage: outcome.usage };
}
