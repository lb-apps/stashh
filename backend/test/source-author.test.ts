import { describe, expect, it } from "vitest";
import { extractAuthor } from "../src/modules/recognitions/instagram-scraper.js";
import { tiktokAuthor } from "../src/modules/recognitions/tiktok-scraper.js";

const page = (description: string) => `<html><meta property="og:description" content="${description}" /></html>`;

describe("extractAuthor", () => {
  it("reads the username in a /<user>/reel/<code> link", () => {
    expect(extractAuthor("https://instagram.com/istanbulfoodie/reel/DQ1abc", null)).toBe("istanbulfoodie");
  });

  it("reads the username from the page's description when the link has none", () => {
    const html = page("1,204 likes, 33 comments - ateneo.gr on October 12, 2026: &quot;Τα καλύτερα καφέ&quot;.");
    expect(extractAuthor("https://instagram.com/reel/DQ1abc", html)).toBe("ateneo.gr");
  });

  it("is null when neither names one", () => {
    expect(extractAuthor("https://instagram.com/p/DQ1abc", null)).toBeNull();
    expect(extractAuthor("https://instagram.com/p/DQ1abc", page("Just a caption"))).toBeNull();
  });
});

describe("tiktokAuthor", () => {
  it("reads the @user of a full link and nothing from a short link", () => {
    expect(tiktokAuthor("https://www.tiktok.com/@manchester.eats/video/7412")).toBe("manchester.eats");
    expect(tiktokAuthor("https://vm.tiktok.com/ZMabc/")).toBeNull();
  });
});
