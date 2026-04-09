import { fetchInstagramContent } from "./instagram.js";
import { analyzeContent, type ProgressEvent } from "./ai-analyzer.js";
import { matchPlaces } from "./place-matcher.js";
import type { RecognitionPipelineResponse, ExtractedPlaceWithMatch } from "../types/schemas.js";

export interface RecognitionPipelineStepEvent {
  step: "fetch" | "download" | "upload" | "analyze" | "places";
  status: "running" | "done";
  duration?: number;
  meta?: Record<string, unknown>;
}

export interface RecognitionPipelineCallbacks {
  onStepEvent?: (event: RecognitionPipelineStepEvent) => void;
  onCaption?: (caption: string | null) => void;
}

function mapAnalysisStepToPipelineStep(step: ProgressEvent["step"]): RecognitionPipelineStepEvent["step"] {
  if (step === "download") return "download";
  if (step === "upload") return "upload";
  return "analyze";
}

export async function runRecognitionPipeline(
  sourceUrl: string,
  callbacks: RecognitionPipelineCallbacks = {},
): Promise<RecognitionPipelineResponse> {
  const onStepEvent = callbacks.onStepEvent ?? (() => {});
  const onCaption = callbacks.onCaption ?? (() => {});

  onStepEvent({ step: "fetch", status: "running" });
  const fetchStartedAt = Date.now();
  const content = await fetchInstagramContent(sourceUrl);
  onStepEvent({ step: "fetch", status: "done", duration: Date.now() - fetchStartedAt });
  onCaption(content.caption);

  const analysis = await analyzeContent(content.videoUrl, content.caption, (event) => {
    onStepEvent({
      step: mapAnalysisStepToPipelineStep(event.step),
      status: event.status,
      duration: event.duration,
      meta: event.meta,
    });
  });

  onStepEvent({ step: "places", status: "running" });
  const placesStartedAt = Date.now();
  const matches = await matchPlaces(analysis.places);
  onStepEvent({
    step: "places",
    status: "done",
    duration: Date.now() - placesStartedAt,
    meta: { count: analysis.places.length },
  });

  const extractedPlaces: ExtractedPlaceWithMatch[] = analysis.places.map((place) => ({
    rawName: place.name,
    locationHint: place.locationHint,
    instagramUsername: place.instagramUsername,
    recommendations: place.recommendations,
    confidenceScore: place.confidenceScore,
    source: place.source,
    matchedPlace: matches.get(place.name) ?? null,
  }));

  return {
    status: "completed",
    sourceUrl,
    extractedPlaces,
  };
}
