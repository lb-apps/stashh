import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const igdl = vi.hoisted(() => vi.fn());
vi.mock("btch-downloader", () => ({ igdl }));

import { fetchInstagramContent } from "../src/modules/recognitions/instagram-scraper.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => log } as never;

/** What Instagram serves a server for many posts: the app shell, no og tags. */
const shell = '<!DOCTYPE html><html><head><title>Instagram</title><meta charset="utf-8" /></head><body></body></html>';

describe("fetchInstagramContent with an unreadable page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    igdl.mockReset();
  });

  it("still resolves the reel through the downloader", async () => {
    igdl.mockResolvedValue({ status: true, result: [{ url: "https://d.example/v.mp4", thumbnail: "https://d.example/t.jpg" }] });
    const content = await fetchInstagramContent("https://instagram.com/reel/DfIJE6KI0Gd", log);
    expect(content).toMatchObject({
      media: [{ url: "https://d.example/v.mp4" }],
      thumbnail_url: "https://d.example/t.jpg",
      fetch_method: "downloader",
      caption: null,
      source_type: "reel",
    });
  });

  it("reports the page error and the downloader's reason when it has nothing either", async () => {
    vi.useFakeTimers();
    igdl.mockResolvedValue({ status: false, message: "rate limited" });
    const pending = expect(fetchInstagramContent("https://instagram.com/reel/DfIJE6KI0Gd", log)).rejects.toThrow(
      /Could not fetch Instagram page for shortcode "DfIJE6KI0Gd".* Downloader: no media \(status false\): rate limited/,
    );
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
  });
});

describe("fetchInstagramContent when the downloader is throttled", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    igdl.mockReset();
  });

  it("names the throttle instead of counting blank items as media", async () => {
    vi.useFakeTimers();
    igdl.mockResolvedValue({ status: true, result: Array.from({ length: 28 }, () => ({ thumbnail: "", url: "" })) });
    const pending = expect(fetchInstagramContent("https://instagram.com/reel/DfAfig_IlO9", log)).rejects.toThrow(/Downloader: throttled: 28 blank items/);
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
  });
});

describe("fetchInstagramContent with the channel's caption", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    igdl.mockReset();
  });

  it("reads the caption alone when no media can be fetched, and keeps why", async () => {
    vi.useFakeTimers();
    igdl.mockResolvedValue({ status: true, result: Array.from({ length: 28 }, () => ({ thumbnail: "", url: "" })) });
    const pending = fetchInstagramContent("https://instagram.com/reel/DfAfig_IlO9", log, "📍Ali Ustanın Yeri");
    await vi.runAllTimersAsync();
    const content = await pending;
    vi.useRealTimers();
    expect(content).toMatchObject({ media: [], fetch_method: "caption", caption: "📍Ali Ustanın Yeri", source_type: "reel" });
    expect(content.media_error).toMatch(/Could not fetch Instagram page.*Downloader: throttled: 28 blank items/);
  });

  it("prefers the channel's caption to the page's", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('<meta property="og:description" content="1 like - u on May 1: &quot;page caption&quot;." />', { status: 200 })),
    );
    igdl.mockResolvedValue({ status: true, result: [{ url: "https://d.example/v.mp4", thumbnail: null }] });
    const content = await fetchInstagramContent("https://instagram.com/reel/DfAfig_IlO9", log, "dm caption");
    expect(content.caption).toBe("dm caption");
    expect(content.fetch_method).toBe("downloader");
  });
});
