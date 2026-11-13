import { describe, expect, it } from "vitest";
import { buildMediaParts, buildUserText } from "../src/modules/recognitions/ai-analyzer.js";
import { dedupeDownloaderItems } from "../src/modules/recognitions/instagram-scraper.js";

/** A downloader link: a proxy URL whose token payload names the real CDN file. */
function link(cdnPath: string, rendition: number): string {
  const payload = Buffer.from(JSON.stringify({ url: `https://scontent.cdninstagram.com${cdnPath}`, rendition })).toString("base64url");
  return `https://d.rapidcdn.app/v2?token=eyJhbGciOiJIUzI1NiJ9.${payload}.sig${rendition}`;
}

describe("dedupeDownloaderItems", () => {
  it("keeps one link per slide, in post order, when every slide comes in several renditions", () => {
    const slides = ["/a.jpg", "/b.jpg", "/c.jpg", "/d.jpg"];
    const items = [1, 2, 3, 4].flatMap((rendition) => slides.map((path) => ({ url: link(path, rendition), thumbnail: `thumb${path}` })));
    const deduped = dedupeDownloaderItems(items);
    expect(deduped).toHaveLength(4);
    expect(deduped.map((item) => item.thumbnail)).toEqual(["thumb/a.jpg", "thumb/b.jpg", "thumb/c.jpg", "thumb/d.jpg"]);
    expect(deduped[0]!.url).toBe(link("/a.jpg", 1));
  });

  it("falls back to the thumbnail, then the link itself, when the link carries no token", () => {
    const items = [
      { url: "https://cdn.example/x?sig=1", thumbnail: "t1" },
      { url: "https://cdn.example/x?sig=2", thumbnail: "t1" },
      { url: "https://cdn.example/y", thumbnail: null },
      { url: "https://cdn.example/y", thumbnail: null },
    ];
    expect(dedupeDownloaderItems(items).map((item) => item.url)).toEqual(["https://cdn.example/x?sig=1", "https://cdn.example/y"]);
  });
});

describe("buildUserText", () => {
  it("names a carousel, tells the model to read every slide, and keeps the caption", () => {
    const text = buildUserText({ platform: "instagram", mediaKind: "image", slideCount: 15, caption: "Kadıköy için 15 mekan" });
    expect(text).toContain("Instagram carousel post of 15 slides");
    expect(text).toContain("Read every slide");
    expect(text).toMatch(/Post caption:\n<<<CAPTION [0-9a-f]{12}>>>\nKadıköy için 15 mekan\n<<<END CAPTION [0-9a-f]{12}>>>/);
    expect(text).toContain("on-screen for that venue in the slides");
  });

  it("asks for the slides to be read as one post, whichever way the venues are spread", () => {
    const text = buildUserText({ platform: "instagram", mediaKind: "image", slideCount: 6, caption: "mekan önerisi" });
    expect(text).toContain("as one post");
    expect(text).toContain("one venue across all its slides or a different venue on each");
  });

  it("tells the model that a post shared in a DM is one item of it, and what is missing", () => {
    const photo = buildUserText({ platform: "instagram", mediaKind: "image", slideCount: 1, caption: "mekan önerisi", sharedItem: true });
    expect(photo).toContain("this Instagram post.");
    expect(photo).toContain("You were given one image of this post");
    expect(photo).toContain("its other slides were not given, and neither were its location tag or its tagged accounts");
    expect(buildUserText({ platform: "instagram", mediaKind: "video", slideCount: 1, caption: null, sharedItem: true })).toContain(
      "You were given one video of this post",
    );
  });

  it("says nothing about missing slides for a link or a carousel it has whole", () => {
    expect(buildUserText({ platform: "instagram", mediaKind: "image", slideCount: 1, caption: "x" })).not.toContain("were not given");
    expect(buildUserText({ platform: "instagram", mediaKind: "image", slideCount: 4, caption: "x", sharedItem: true })).not.toContain("were not given");
  });

  it("describes a single photo or video as before", () => {
    expect(buildUserText({ platform: "instagram", mediaKind: "image", slideCount: 1, caption: null })).toContain("Instagram photo post");
    expect(buildUserText({ platform: "instagram", mediaKind: "video", slideCount: 1, caption: null })).not.toContain("slide");
    expect(buildUserText({ platform: "tiktok", mediaKind: "video", slideCount: 1, caption: "x" })).toContain("always return null");
  });
});

describe("buildMediaParts", () => {
  const image = (n: number) => ({ part: { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${n}` } } });

  it("sends a single item bare", () => {
    expect(buildMediaParts([image(1)])).toEqual([image(1).part]);
  });

  it("announces each slide of a carousel by number", () => {
    const parts = buildMediaParts([image(1), image(2), image(3)]);
    expect(parts).toHaveLength(6);
    expect(parts[0]).toEqual({ type: "text", text: "Slide 1 of 3:" });
    expect(parts[1]).toEqual(image(1).part);
    expect(parts[4]).toEqual({ type: "text", text: "Slide 3 of 3:" });
  });
});
