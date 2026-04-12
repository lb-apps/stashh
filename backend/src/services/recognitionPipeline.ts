import { fetchInstagramContent } from "./instagram.js";
import { analyzeContent } from "./ai-analyzer.js";
import { matchPlaces } from "./place-matcher.js";
import type { RecognitionPipelineResponse, ExtractedPlaceWithMatch } from "../types/schemas.js";

export async function runRecognitionPipeline(
  sourceUrl: string,
): Promise<RecognitionPipelineResponse> {
  const content = await fetchInstagramContent(sourceUrl);
  const analysis = await analyzeContent(content.videoUrl, content.caption);
  const matches = await matchPlaces(analysis.places);

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
