import { describe, expect, it } from "vitest";
import { recognitionErrorCode } from "../src/modules/recognitions/failure-reason.js";
import { calculateRetryBackoff } from "../src/modules/recognitions/service.js";
import { buildUserText } from "../src/modules/recognitions/ai-analyzer.js";

describe("recognitionErrorCode", () => {
  const failed = (error_message: string | null) => recognitionErrorCode({ status: "failed", error_message });

  it("is null unless the recognition failed", () => {
    expect(recognitionErrorCode({ status: "completed", error_message: null })).toBeNull();
    expect(recognitionErrorCode({ status: "queued", error_message: "Downloader: throttled: 28 blank items" })).toBeNull();
  });

  it("names a private post from Instagram's login page", () => {
    expect(failed('Instagram returned a login page for shortcode "X". The post may be private')).toBe("private");
  });

  it("calls withheld or throttled media temporary", () => {
    expect(failed('Could not fetch Instagram page for shortcode "DfIJE6KI0Gd" (last HTTP status: 200). Downloader: throttled: 28 blank items')).toBe(
      "temporarily_unavailable",
    );
    expect(failed("Could not extract media from Instagram page (shortcode: DfAfig_IlO9).")).toBe("temporarily_unavailable");
    expect(failed("Failed to fetch media: HTTP 403 Forbidden")).toBe("temporarily_unavailable");
    expect(failed("TikTok downloader failed: timeout")).toBe("temporarily_unavailable");
  });

  it("calls anything else unreadable", () => {
    expect(failed("Model analysis failed: 502")).toBe("unreadable");
    expect(failed(null)).toBe("unreadable");
  });
});

describe("calculateRetryBackoff", () => {
  it("waits 5, 15 and 45 seconds, so the retries outlast the downloader's throttle", () => {
    expect([0, 1, 2].map((count) => calculateRetryBackoff(count).delayMilliseconds)).toEqual([5_000, 15_000, 45_000]);
    expect(calculateRetryBackoff(5).delayMilliseconds).toBe(60_000);
  });
});

describe("buildUserText without media", () => {
  it("tells the model the caption is all it has", () => {
    const text = buildUserText({ platform: "instagram", mediaKind: null, slideCount: 0, caption: "📍Ali Ustanın Yeri : Üçkuyular İzmir" });
    expect(text).toContain("Its media could not be read");
    expect(text).toContain("Post caption:\n📍Ali Ustanın Yeri : Üçkuyular İzmir");
    expect(text).toContain("only if that @handle appears in this caption");
  });
});
