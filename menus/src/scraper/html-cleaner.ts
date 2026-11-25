import { load } from "cheerio";

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "nav",
  "footer",
  "header",
  ".cookie-banner",
  ".popup",
  ".modal",
  "#cookie-consent",
  "[role='banner']",
  "[role='navigation']",
  "[role='contentinfo']",
];

export function cleanHtml(html: string, baseUrl: string): { text: string; imageUrls: string[] } {
  const $ = load(html);

  for (const selector of NOISE_SELECTORS) {
    $(selector).remove();
  }

  const imageUrls: string[] = [];

  $("img").each((_, el) => {
    const src = $(el).attr("src");
    const lazySrc = $(el).attr("data-src") ?? $(el).attr("data-lazy-src") ?? $(el).attr("data-original");
    const resolved = (src && !src.startsWith("data:")) ? src : lazySrc;
    if (!resolved) return;
    try {
      const absolute = new URL(resolved, baseUrl).href;
      if (absolute.startsWith("http") && !absolute.includes("data:")) {
        imageUrls.push(absolute);
        $(el).replaceWith(`\n[IMG: ${absolute}]\n`);
      }
    } catch {
      // skip
    }
  });

  const text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  const maxLength = 50_000;
  return {
    text: text.length > maxLength ? text.slice(0, maxLength) : text,
    imageUrls: [...new Set(imageUrls)],
  };
}
