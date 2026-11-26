import { afterEach, describe, expect, it, vi } from "vitest";

const igdl = vi.hoisted(() => vi.fn());
vi.mock("btch-downloader", () => ({ igdl }));

import { extractVideoUrl, fetchInstagramContent } from "../src/modules/recognitions/instagram-scraper.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => log } as never;

const REEL = "DSaaqfYDZnd";
const OWN = "https://scontent.cdninstagram.com/o1/own.mp4?oh=a&oe=b";
const SUGGESTED = "https://scontent.cdninstagram.com/o1/suggested.mp4?oh=c&oe=d";

/** A JSON script block as Instagram embeds the page's data. */
const block = (data: unknown) => `<script type="application/json" data-sjs>${JSON.stringify(data)}</script>`;

/**
 * A signed-in reel page as Instagram serves it: a reel it suggests next, whose
 * `video_versions` lists width first and comes first in the page, then the reel itself.
 */
const signedInPage = (own: unknown = { code: REEL, video_versions: [{ type: 101, url: OWN, width: 720, height: 1280 }] }) =>
  [
    "<html><head>",
    '<meta property="og:description" content="1 like - emirstour on May 1: &quot;caption&quot;." />',
    "</head><body>",
    block({ require: [["ScheduledServerJS", { __bbox: { items: [{ code: "Dewu7v9NxDh", video_versions: [{ width: 720, height: 1280, url: SUGGESTED, type: 101 }] }] } }]] }),
    block({ require: [["ScheduledServerJS", { __bbox: { media: own } }]] }),
    "</body></html>",
  ].join("");

describe("extractVideoUrl", () => {
  it("takes the reel's own video, not the suggested reel that comes first", () => {
    expect(extractVideoUrl(signedInPage(), REEL)).toBe(OWN);
  });

  it("takes nothing when the page carries only other reels", () => {
    expect(extractVideoUrl(signedInPage(null), REEL)).toBeNull();
  });

  it("falls back on the page's own og:video tag", () => {
    const page = `${signedInPage(null)}<meta property="og:video" content="https://scontent.cdninstagram.com/og.mp4?a=1&amp;b=2" />`;
    expect(extractVideoUrl(page, REEL)).toBe("https://scontent.cdninstagram.com/og.mp4?a=1&b=2");
  });

  it("skips a block that is not valid JSON", () => {
    const page = `<script type="application/json">{not json</script>${signedInPage()}`;
    expect(extractVideoUrl(page, REEL)).toBe(OWN);
  });
});

describe("fetchInstagramContent on a signed-in page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    igdl.mockReset();
  });

  /** Serves `page` for the reel page and a playable range for every video probe. */
  const serve = (page: string) => {
    const fetch = vi.fn(async (url: string) =>
      url.startsWith("https://www.instagram.com/") ? new Response(page, { status: 200 }) : new Response("", { status: 206 }),
    );
    vi.stubGlobal("fetch", fetch);
    return fetch;
  };

  it("analyzes the reel's own video", async () => {
    serve(signedInPage());
    const content = await fetchInstagramContent(`https://instagram.com/reel/${REEL}`, log);
    expect(content).toMatchObject({ media: [{ url: OWN }], fetch_method: "scrape" });
    expect(igdl).not.toHaveBeenCalled();
  });

  it("asks the downloader when the page shows only a suggested reel", async () => {
    const fetch = serve(signedInPage(null));
    igdl.mockResolvedValue({ status: true, result: [{ url: "https://d.example/own.mp4", thumbnail: null }] });
    const content = await fetchInstagramContent(`https://instagram.com/reel/${REEL}`, log);
    expect(content).toMatchObject({ media: [{ url: "https://d.example/own.mp4" }], fetch_method: "downloader" });
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(SUGGESTED);
  });
});
