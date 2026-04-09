import { mkdir, readdir, readFile, appendFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const LOG_DIR = join(process.cwd(), "logs");
const MAX_FILES = 20;

let logDirReady: Promise<void> | null = null;

function ensureLogDir(): Promise<void> {
  logDirReady ??= mkdir(LOG_DIR, { recursive: true }).then(() => {});
  return logDirReady;
}

async function pruneOldLogs(): Promise<void> {
  try {
    const files = (await readdir(LOG_DIR))
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse();
    await Promise.all(
      files.slice(MAX_FILES).map(async (f) => {
        try {
          await unlink(join(LOG_DIR, f));
        } catch {
          /* ignore */
        }
      }),
    );
  } catch {
    /* ignore */
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogEntry {
  ts: string;
  requestId: string;
  event: string;
  [key: string]: unknown;
}

export interface RequestLogger {
  requestId: string;
  info(event: string, data?: Record<string, unknown>): Promise<void>;
  error(event: string, err: unknown, data?: Record<string, unknown>): Promise<void>;
  done(data?: Record<string, unknown>): Promise<void>;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createRequestLogger(url: string): Promise<RequestLogger> {
  await ensureLogDir();

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = Math.random().toString(36).slice(2, 6);
  const requestId = `${timestamp}_${suffix}`;
  const logFile = join(LOG_DIR, `${requestId}.jsonl`);

  let writeChain: Promise<void> = Promise.resolve();

  function scheduleWrite(fn: () => Promise<void>): Promise<void> {
    writeChain = writeChain.then(fn, (err) => {
      console.error("[logger] write failed", err);
    });
    return writeChain;
  }

  async function write(data: Record<string, unknown>): Promise<void> {
    const entry = {
      ts: new Date().toISOString(),
      requestId,
      ...data,
    } as LogEntry;
    await appendFile(logFile, JSON.stringify(entry) + "\n", "utf8");
  }

  setImmediate(() => {
    void pruneOldLogs();
  });

  await write({ event: "request_start", url });

  return {
    requestId,

    info(event, data = {}) {
      return scheduleWrite(() => write({ event, ...data }));
    },

    error(event, err, data = {}) {
      return scheduleWrite(() =>
        write({
          event,
          ...data,
          error:
            err instanceof Error
              ? { message: err.message, name: err.name, stack: err.stack }
              : { message: String(err) },
        }),
      );
    },

    done(data = {}) {
      return scheduleWrite(() => write({ event: "request_end", ...data }));
    },
  };
}

// ─── Reader (for /logs endpoint) ─────────────────────────────────────────────

export interface LogFile {
  requestId: string;
  filename: string;
  entries: LogEntry[];
}

export async function listLogFiles(): Promise<string[]> {
  await ensureLogDir();
  return (await readdir(LOG_DIR))
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse();
}

export async function readLogFile(filename: string): Promise<LogFile> {
  await ensureLogDir();
  const safeName = filename.replace(/[^a-zA-Z0-9_\-.]/g, "");
  const content = await readFile(join(LOG_DIR, safeName), "utf-8");
  const entries = content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LogEntry);
  const requestId = entries[0]?.requestId ?? safeName;
  return { requestId, filename: safeName, entries };
}
