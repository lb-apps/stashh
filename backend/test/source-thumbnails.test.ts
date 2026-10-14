import { pino } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sourceThumbnailPath, uploadSourceThumbnail } from "../src/lib/sourceThumbnailUploader.js";
import { extractThumbnail } from "../src/modules/recognitions/instagram-scraper.js";

const log = pino({ level: "silent" });

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeStorage() {
  const uploads: Array<{ bucket: string; path: string; contentType: string }> = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _bytes: Uint8Array, options: { contentType: string }) => {
          uploads.push({ bucket, path, contentType: options.contentType });
          return { error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
      }),
    },
  };
  return { client, uploads };
}

const respond = (status: number, contentType: string, bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])) =>
  vi.fn(async () => new Response(bytes, { status, headers: { "content-type": contentType } }));

describe("extractThumbnail", () => {
  it("reads the og:image of an Instagram page and decodes its entities", () => {
    const html = '<meta property="og:image" content="https://scontent.cdninstagram.com/v/t51.jpg?a=1&amp;b=2" />';
    expect(extractThumbnail(html)).toBe("https://scontent.cdninstagram.com/v/t51.jpg?a=1&b=2");
  });

  it("is null when the page has none", () => {
    expect(extractThumbnail("<html></html>")).toBeNull();
  });
});

describe("uploadSourceThumbnail", () => {
  it("copies an image into the bucket under a key derived from the source", async () => {
    vi.stubGlobal("fetch", respond(200, "image/jpeg"));
    const { client, uploads } = fakeStorage();

    const url = await uploadSourceThumbnail("https://cdn.example/cover.jpg", "https://instagram.com/reel/A", client as never, log);

    const path = sourceThumbnailPath("https://instagram.com/reel/A", "jpg");
    expect(uploads).toEqual([{ bucket: "source-thumbnails", path, contentType: "image/jpeg" }]);
    expect(url).toBe(`https://cdn.test/source-thumbnails/${path}`);
    expect(path).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{62}\.jpg$/);
  });

  it("stores nothing for a video (a video post shared in a DM has no still image)", async () => {
    vi.stubGlobal("fetch", respond(200, "video/mp4"));
    const { client, uploads } = fakeStorage();
    expect(await uploadSourceThumbnail("https://cdn.example/v.mp4", "instagram-media:1", client as never, log)).toBeNull();
    expect(uploads).toHaveLength(0);
  });

  it("returns null instead of throwing when the image cannot be fetched", async () => {
    vi.stubGlobal("fetch", respond(404, "text/html"));
    const { client } = fakeStorage();
    expect(await uploadSourceThumbnail("https://cdn.example/gone.jpg", "k", client as never, log)).toBeNull();
  });
});
