import { describe, expect, it } from "vitest";
import { extractCaption } from "../src/modules/recognitions/instagram-scraper.js";

const page = (description: string) => `<meta property="og:description" content="${description}" />`;

describe("extractCaption", () => {
  it("keeps emoji above U+FFFF from numeric entities", () => {
    const html = page("12 likes - eats on May 1: &quot;&#x1f4cd;Kadık&#xf6;y &#128204;Mekan&quot;.");
    expect(extractCaption(html)).toBe("📍Kadıköy 📌Mekan");
  });

  it("drops the closing quote and full stop Instagram wraps the caption in", () => {
    expect(extractCaption(page("3 likes - user on May 1: &quot;#burger #kad&#x131;k&#xf6;y&quot;."))).toBe("#burger #kadıköy");
  });

  it("leaves an out-of-range entity as written", () => {
    expect(extractCaption(page("&#x110000; ok"))).toBe("&#x110000; ok");
  });
});
