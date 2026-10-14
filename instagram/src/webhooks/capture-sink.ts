import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "../lib/logger.ts";
import type { VerifiedDelivery, WebhookSink } from "./routes.ts";

/**
 * Development sink: writes each verified delivery verbatim so real Meta payloads
 * can be reviewed and promoted to test fixtures. Never wired in production
 * (enforced by config).
 */
export class CaptureSink implements WebhookSink {
  private readonly dir: string;
  private readonly log: Logger;

  constructor(dir: string, log: Logger) {
    this.dir = dir;
    this.log = log;
  }

  async accept({ rawBody, body, receivedAt }: VerifiedDelivery): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `${receivedAt.toISOString().replaceAll(":", "-")}.json`);
    await writeFile(file, rawBody);
    this.log.info({ file, entries: body.entry.length }, "webhook delivery captured");
  }
}
