import type { Logger } from "./logger.ts";

const domainLastRequest = new Map<string, number>();
const MIN_DELAY_MS = 1000;

export interface HttpClientOptions {
  log: Logger;
  respectRobots?: boolean;
}

export class HttpClient {
  private log: Logger;
  private respectRobots: boolean;
  private robotsCache = new Map<string, { allowed: boolean; checkedAt: number }>();
  private static readonly ROBOTS_TTL_MS = 60 * 60 * 1000;

  constructor(options: HttpClientOptions) {
    this.log = options.log;
    this.respectRobots = options.respectRobots ?? true;
  }

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const parsed = new URL(url);
    const domain = parsed.hostname;

    if (this.respectRobots) {
      const allowed = await this.checkRobots(parsed.origin);
      if (!allowed) {
        this.log.info({ url, domain }, "blocked by robots.txt");
        throw new RobotsBlockedError(url);
      }
    }

    await this.rateLimit(domain);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: options?.signal ?? controller.signal,
        headers: {
          "User-Agent": "StashhBot/1.0 (+https://stashh.me)",
          Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
          ...options?.headers,
        },
      });
      domainLastRequest.set(domain, Date.now());
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async rateLimit(domain: string): Promise<void> {
    const last = domainLastRequest.get(domain);
    if (last) {
      const elapsed = Date.now() - last;
      if (elapsed < MIN_DELAY_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsed));
      }
    }
  }

  private async checkRobots(origin: string): Promise<boolean> {
    const cached = this.robotsCache.get(origin);
    if (cached && Date.now() - cached.checkedAt < HttpClient.ROBOTS_TTL_MS) {
      return cached.allowed;
    }

    try {
      const response = await fetch(`${origin}/robots.txt`, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "StashhBot/1.0" },
      });
      if (!response.ok) {
        this.robotsCache.set(origin, { allowed: true, checkedAt: Date.now() });
        return true;
      }

      const text = await response.text();
      const allowed = !isDisallowed(text, "/");
      this.robotsCache.set(origin, { allowed, checkedAt: Date.now() });
      return allowed;
    } catch {
      this.robotsCache.set(origin, { allowed: true, checkedAt: Date.now() });
      return true;
    }
  }
}

function isDisallowed(robotsTxt: string, path: string): boolean {
  let inStashhBlock = false;
  let inWildcardBlock = false;
  for (const raw of robotsTxt.split("\n")) {
    const line = raw.split("#")[0]!.trim().toLowerCase();
    if (line.startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim();
      inStashhBlock = agent === "stashhbot";
      inWildcardBlock = agent === "*";
    } else if ((inStashhBlock || inWildcardBlock) && line.startsWith("disallow:")) {
      const disallowed = line.slice("disallow:".length).trim();
      if (disallowed && path.startsWith(disallowed)) return true;
    }
  }
  return false;
}

export class RobotsBlockedError extends Error {
  url: string;
  constructor(url: string) {
    super(`Blocked by robots.txt: ${url}`);
    this.url = url;
    this.name = "RobotsBlockedError";
  }
}
