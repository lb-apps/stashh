import type { Logger } from "../../lib/logger.js";
import type { Transcript, TranscriptSegment } from "../../types/schemas.js";
import { cleanUntrustedText } from "../../lib/untrusted-text.js";

// The transcript is kept in full: bounds that only stop a runaway response, not a long reel.
const MAX_FULL_TEXT_CHARS = 20_000;
const MAX_SEGMENT_CHARS = 500;
const MAX_SEGMENTS = 400;
const NO_SPEECH_THRESHOLD = 0.6;
/** A dropped connection or a 429/5xx gets one more try a second later. */
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

/**
 * Whisper could not be reached or refused the request. Not "no speech": that is a null transcript.
 * The caller keeps the transcript it already has for the source instead of erasing it.
 */
export class WhisperUnavailableError extends Error {}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  no_speech_prob?: number;
}

interface WhisperVerboseResponse {
  text: string;
  language?: string;
  segments?: WhisperSegment[];
}

/**
 * Transcribes a video's speech through OpenRouter's speech-to-text endpoint. It runs alongside the
 * vision model and is the only transcript a result keeps. Takes the MP3 `extract-media` pulls out
 * of the video, or the video itself when that failed (the endpoint accepts mp4).
 *
 * Returns null when the audio holds no speech (music, silence). Throws `WhisperUnavailableError`
 * when Whisper could not answer, after one retry.
 */
export async function transcribeVideo(
  mediaBuffer: Buffer,
  opts: { apiKey: string; model: string; log: Logger; contentType?: string; fileName?: string },
): Promise<Transcript | null> {
  const { apiKey, model, log } = opts;
  const t0 = Date.now();

  const form = new FormData();
  const ab = mediaBuffer.buffer.slice(mediaBuffer.byteOffset, mediaBuffer.byteOffset + mediaBuffer.byteLength) as ArrayBuffer;
  form.append("file", new Blob([ab], { type: opts.contentType ?? "video/mp4" }), opts.fileName ?? "video.mp4");
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  let res: Response | null = null;
  let failure = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (res.ok) break;
      failure = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
      if (res.status !== 429 && res.status < 500) break;
    } catch (error) {
      res = null;
      failure = `network: ${error instanceof Error ? error.message : String(error)}`;
    }
    log.warn({ attempt, failure, model }, "whisper attempt failed");
    if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  if (!res?.ok) throw new WhisperUnavailableError(`Whisper unavailable (${failure})`);

  const result = (await res.json()) as WhisperVerboseResponse;
  const duration = Date.now() - t0;

  const rawSegments = (result.segments ?? []).filter(
    (s) => s.text?.trim() && typeof s.start === "number" && typeof s.end === "number",
  );

  // Drop segments Whisper is not confident contain speech (music, silence, noise).
  const speechSegments = rawSegments.filter((s) => (s.no_speech_prob ?? 0) < NO_SPEECH_THRESHOLD);

  if (speechSegments.length === 0) {
    log.info({ duration, model, raw: rawSegments.length }, "whisper found no speech segments (music or silence)");
    return null;
  }

  const segments: TranscriptSegment[] = speechSegments
    .map((s) => ({
      text: cleanUntrustedText(s.text.trim(), MAX_SEGMENT_CHARS) ?? "",
      start_s: Math.round(s.start * 100) / 100,
      end_s: Math.round(s.end * 100) / 100,
    }))
    .filter((s) => s.text.length > 0)
    .slice(0, MAX_SEGMENTS);

  if (segments.length === 0) {
    log.info({ duration, model }, "whisper returned empty transcript");
    return null;
  }

  const fullText = cleanUntrustedText(segments.map((s) => s.text).join(" "), MAX_FULL_TEXT_CHARS);
  if (!fullText) {
    log.info({ duration, model }, "whisper returned empty transcript after cleaning");
    return null;
  }

  log.info(
    { duration, model, segments: segments.length, dropped: rawSegments.length - speechSegments.length, chars: fullText.length, sizeKb: Math.round(mediaBuffer.length / 1024) },
    "whisper transcription complete",
  );

  return { full_text: fullText, segments, model, language: result.language?.trim() || null };
}
