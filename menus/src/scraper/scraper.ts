import type { HttpClient } from "../lib/http-client.ts";
import type { Logger } from "../lib/logger.ts";
import { cleanHtml } from "./html-cleaner.ts";
import { parsePdf } from "./pdf-parser.ts";

export interface ScrapeResult {
  content: string;
  contentType: "html" | "pdf";
  imageUrls: string[];
}

export async function scrapeMenuPage(url: string, httpClient: HttpClient, log: Logger): Promise<ScrapeResult | null> {
  try {
    const response = await httpClient.fetch(url);
    if (!response.ok) {
      log.debug({ url, status: response.status }, "scrape fetch failed");
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/pdf")) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const pdfContent = await parsePdf(buffer, log);
      return pdfContent ? { content: pdfContent, contentType: "pdf", imageUrls: [] } : null;
    }

    if (contentType.includes("text/html")) {
      const html = await response.text();
      const { text, imageUrls } = cleanHtml(html, url);
      if (!text.trim()) {
        log.debug({ url }, "scraped page has no text content");
        return null;
      }
      return { content: text, contentType: "html", imageUrls };
    }

    log.debug({ url, contentType }, "unsupported content type");
    return null;
  } catch (error) {
    log.warn({ url, err: error }, "scrape error");
    return null;
  }
}
