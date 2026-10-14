import { afterEach, describe, expect, it, vi } from "vitest";
import { pino } from "pino";
import { toMediaPart } from "../src/modules/recognitions/ai-analyzer.js";
import { fetchSourceContent } from "../src/modules/recognitions/source-content.js";
import { createInternalRecognitionRequestSchema } from "../src/modules/recognitions/types.js";

const log = pino({ level: "silent" });
const CDN = "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18008721881113680&signature=abc";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("internal recognition request", () => {
  it("accepts a post URL, as the public API does", () => {
    expect(createInternalRecognitionRequestSchema.safeParse({ source_url: "https://www.instagram.com/reel/ABC/" }).success).toBe(true);
  });

  it("accepts a post shared in a DM", () => {
    const parsed = createInternalRecognitionRequestSchema.safeParse({
      shared_media: { provider: "instagram", media_id: "18008721881113680", media_url: CDN, caption: "jazz" },
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    ["an unknown host", "https://evil.example/ig_messaging_cdn/?asset_id=1"],
    ["plain http", "http://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1"],
    ["a look-alike host", "https://lookaside.fbsbx.com.evil.example/x"],
  ])("refuses a media URL on %s", (_, url) => {
    const parsed = createInternalRecognitionRequestSchema.safeParse({
      shared_media: { provider: "instagram", media_id: "1", media_url: url, caption: null },
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a media id that is not numeric", () => {
    const parsed = createInternalRecognitionRequestSchema.safeParse({
      shared_media: { provider: "instagram", media_id: "../1", media_url: CDN, caption: null },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("fetchSourceContent", () => {
  it("uses the content a channel supplied instead of scraping", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const content = await fetchSourceContent(
      {
        source_url: "instagram-media:18008721881113680",
        source_media: { media_url: CDN, caption: "jazz", platform: "instagram", source_type: "post" },
      },
      log,
    );

    expect(content).toEqual({ media_url: CDN, caption: "jazz", platform: "instagram", source_type: "post" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed supplied content", async () => {
    await expect(
      fetchSourceContent({ source_url: "instagram-media:1", source_media: { caption: "no media" } }, log),
    ).rejects.toThrow(/source_media/);
  });
});

describe("toMediaPart", () => {
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(16)]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);

  it("sends a video as a video part", () => {
    expect(toMediaPart("video/mp4", mp4)).toEqual({
      kind: "video",
      part: { type: "video_url", video_url: { url: `data:video/mp4;base64,${mp4.toString("base64")}` } },
    });
  });

  it("sends an image as an image part, keeping its real type", () => {
    expect(toMediaPart("image/jpeg; charset=binary", jpeg).part).toEqual({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
    });
  });

  it.each([
    ["an MP4 served as octet-stream (Instagram's video CDN)", "application/octet-stream", mp4, "video", "video/mp4"],
    ["a JPEG without a content type", null, jpeg, "image", "image/jpeg"],
    ["a PNG as binary/octet-stream", "binary/octet-stream", png, "image", "image/png"],
    ["a WebP with an empty type", "", webp, "image", "image/webp"],
  ] as const)("recognises %s from its bytes", (_, contentType, bytes, kind, mime) => {
    const media = toMediaPart(contentType, bytes);
    expect(media.kind).toBe(kind);
    expect(JSON.stringify(media.part)).toContain(`data:${mime};base64,`);
  });

  it("refuses what is neither video nor image", () => {
    expect(() => toMediaPart("text/html", Buffer.from("<html>"))).toThrow(/text\/html/);
    expect(() => toMediaPart("application/octet-stream", Buffer.from("plain bytes"))).toThrow(/application\/octet-stream/);
  });
});
