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

  it("reports the page error when the downloader has nothing either", async () => {
    vi.useFakeTimers();
    igdl.mockResolvedValue({ status: false, result: [] });
    const pending = expect(fetchInstagramContent("https://instagram.com/reel/DfIJE6KI0Gd", log)).rejects.toThrow(
      /Could not fetch Instagram page for shortcode "DfIJE6KI0Gd"/,
    );
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
  });
});
