import ffmpeg from "fluent-ffmpeg";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Logger } from "../../lib/logger.js";

export interface ExtractedVideo {
  audio: Buffer | null;
}

const AUDIO_BITRATE = "64k";
const FFMPEG_TIMEOUT_MS = 30_000;

function runFfmpeg(
  inputPath: string,
  configure: (cmd: ffmpeg.FfmpegCommand) => ffmpeg.FfmpegCommand,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cmd.kill("SIGKILL");
      reject(new Error("ffmpeg timed out"));
    }, FFMPEG_TIMEOUT_MS);

    const cmd = configure(ffmpeg(inputPath));
    cmd
      .on("end", () => { clearTimeout(timer); resolve(); })
      .on("error", (err) => { clearTimeout(timer); reject(err); })
      .run();
  });
}

export async function extractVideoMedia(
  videoBuffer: Buffer,
  log: Logger,
): Promise<ExtractedVideo | null> {
  const dir = join(tmpdir(), `stashh-ffmpeg-${randomUUID()}`);
  const inputPath = join(dir, "input.mp4");
  const audioPath = join(dir, "audio.mp3");

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(inputPath, videoBuffer);

    await runFfmpeg(inputPath, (cmd) =>
      cmd.noVideo().audioCodec("libmp3lame").audioBitrate(AUDIO_BITRATE).audioChannels(1).output(audioPath),
    );

    let audio: Buffer | null = null;
    try {
      audio = await readFile(audioPath);
    } catch {
      log.warn("ffmpeg produced no audio file");
      return null;
    }

    log.info(
      { audioKb: Math.round(audio.length / 1024), originalKb: Math.round(videoBuffer.length / 1024) },
      "audio extracted",
    );

    return { audio };
  } catch (error) {
    log.info({ error: error instanceof Error ? error.message : String(error) }, "audio extraction failed (video may have no audio track)");
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
