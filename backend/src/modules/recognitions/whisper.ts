import type { Logger } from "../../lib/logger.js";
import type { Transcript, TranscriptSegment } from "../../types/schemas.js";
import { cleanUntrustedText } from "../../lib/untrusted-text.js";

const MAX_FULL_TEXT_CHARS = 5_000;
const MAX_SEGMENT_CHARS = 500;
const MAX_SEGMENTS = 100;
const NO_SPEECH_THRESHOLD = 0.6;

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  no_speech_prob?: number;
}

interface WhisperVerboseResponse {
  text: string;
  segments?: WhisperSegment[];
}

/**
 * Transcribe audio from a video buffer using OpenRouter's STT endpoint.
 * Runs before Gemini so the transcript reaches the vision model as prompt text.
 * The endpoint accepts mp4 directly — no ffmpeg extraction needed.
 */
export async function transcribeVideo(
  videoBuffer: Buffer,
  opts: { apiKey: string; model: string; log: Logger },
): Promise<Transcript | null> {
  const { apiKey, model, log } = opts;
  const t0 = Date.now();

  const form = new FormData();
  const ab = videoBuffer.buffer.slice(videoBuffer.byteOffset, videoBuffer.byteOffset + videoBuffer.byteLength) as ArrayBuffer;
  form.append("file", new Blob([ab], { type: "video/mp4" }), "video.mp4");
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : String(error), model }, "whisper network error");
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    log.warn({ status: res.status, body: body.slice(0, 300), model }, "whisper transcription failed");
    return null;
  }

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
    { duration, model, segments: segments.length, dropped: rawSegments.length - speechSegments.length, chars: fullText.length, sizeKb: Math.round(videoBuffer.length / 1024) },
    "whisper transcription complete",
  );

  return { full_text: fullText, segments };
}
