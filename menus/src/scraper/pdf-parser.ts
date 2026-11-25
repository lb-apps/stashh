import pdf from "pdf-parse";
import type { Logger } from "../lib/logger.ts";

export async function parsePdf(buffer: Buffer, log: Logger): Promise<string | null> {
  try {
    const data = await pdf(buffer);
    const text = data.text?.trim();
    if (!text || text.length < 20) {
      log.debug("PDF has insufficient text content");
      return null;
    }
    const maxLength = 50_000;
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  } catch (error) {
    log.warn({ err: error }, "PDF parse error");
    return null;
  }
}
