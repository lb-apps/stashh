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
  it("sends a video as a video part", () => {
    expect(toMediaPart("video/mp4", "AAAA")).toEqual({
      kind: "video",
      part: { type: "video_url", video_url: { url: "data:video/mp4;base64,AAAA" } },
    });
  });

  it("sends an image as an image part, keeping its real type", () => {
    expect(toMediaPart("image/jpeg; charset=binary", "AAAA")).toEqual({
      kind: "image",
      part: { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
    });
  });

  it("refuses anything else", () => {
    expect(() => toMediaPart("text/html", "AAAA")).toThrow(/text\/html/);
    expect(() => toMediaPart(null, "AAAA")).toThrow(/unknown/);
  });
});
