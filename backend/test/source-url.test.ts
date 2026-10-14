import { describe, expect, it } from "vitest";
import { isSupportedSourceUrl } from "../src/modules/recognitions/types.js";

describe("isSupportedSourceUrl", () => {
  it.each([
    "https://www.instagram.com/reel/C8xYz12AbCd/",
    "https://instagram.com/reels/C8xYz12AbCd",
    "https://www.instagram.com/p/C8xYz12AbCd/?igsh=abc",
    "https://www.instagram.com/tv/C8xYz12AbCd/",
    "https://www.instagram.com/some.user/reel/C8xYz12AbCd/",
    "https://www.tiktok.com/@someone/video/7400000000000000000",
    "https://vm.tiktok.com/ZMabc123/",
  ])("accepts %s", (url) => {
    expect(isSupportedSourceUrl(url)).toBe(true);
  });

  it.each([
    // Stories are login-gated and expire — they come in through a channel as media.
    "https://www.instagram.com/stories/someone/3400000000000000000/",
    "https://www.instagram.com/someone/",
    "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1",
    "https://evil.com/instagram.com/reel/abc",
    "https://notinstagram.com/reel/abc",
  ])("rejects %s", (url) => {
    expect(isSupportedSourceUrl(url)).toBe(false);
  });
});
