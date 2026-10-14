import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type AppDeps } from "../src/http/app.ts";
import type { OpsRange } from "../src/ops/range.ts";

const TOKEN = "o".repeat(40);
const log = pino({ level: "silent" });
const base: AppDeps = { appSecret: "s", verifyToken: "verify-token-0123456789", sink: { accept: async () => {} }, log };

async function serve(deps: AppDeps): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createApp(deps).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("GET /ops/stats", () => {
  const ranges: OpsRange[] = [];
  let app: Awaited<ReturnType<typeof serve>>;

  beforeAll(async () => {
    app = await serve({
      ...base,
      ops: {
        tokens: [TOKEN],
        snapshot: async (range) => {
          ranges.push(range.range);
          return { worker: { in_flight: 2 } };
        },
      },
    });
  });
  afterAll(() => app.close());

  const get = (path: string, token?: string) =>
    fetch(`${app.url}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  it("refuses a request without the ops token", async () => {
    expect((await get("/ops/stats")).status).toBe(401);
    expect((await get("/ops/stats", "x".repeat(40))).status).toBe(401);
  });

  it("returns the snapshot for the requested range", async () => {
    const res = await get("/ops/stats?range=7d", TOKEN);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ range: "7d", bucket: "day", stats: { worker: { in_flight: 2 } } });
    expect(ranges.at(-1)).toBe("7d");
  });

  it("rejects an unknown range", async () => {
    expect((await get("/ops/stats?range=1y", TOKEN)).status).toBe(400);
  });
});

describe("without ops tokens", () => {
  it("does not expose the route at all", async () => {
    const app = await serve(base);
    expect((await fetch(`${app.url}/ops/stats`)).status).toBe(404);
    await app.close();
  });
});
