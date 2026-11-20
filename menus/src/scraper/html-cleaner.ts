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
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    try {
      const absolute = new URL(src, baseUrl).href;
      if (absolute.startsWith("http") && !absolute.includes("data:")) {
        imageUrls.push(absolute);
      }
    } catch {
      // skip
    }
  });

  const text = $("body").text().replace(/\s+/g, " ").trim();

  const maxLength = 50_000;
  return {
    text: text.length > maxLength ? text.slice(0, maxLength) : text,
    imageUrls: [...new Set(imageUrls)],
  };
}
