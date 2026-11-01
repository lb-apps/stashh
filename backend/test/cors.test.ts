import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCors } from "../src/http/cors.js";

const app = express();
app.use(createCors(["https://stashh.me", "http://localhost:3001"]));
app.get("/api/v1/places", (_req, res) => {
  res.json({ ok: true });
});

let base = "";
let server: ReturnType<typeof app.listen>;
beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
});

describe("createCors", () => {
  it("answers an allowed origin with its own origin", async () => {
    const response = await fetch(`${base}/api/v1/places`, { headers: { origin: "https://stashh.me" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("https://stashh.me");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("gives any other origin no CORS headers, so the browser blocks it", async () => {
    for (const origin of ["https://evil.example", "https://stashh.me.evil.example", "http://localhost:3000"]) {
      const response = await fetch(`${base}/api/v1/places`, { headers: { origin } });
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("leaves requests without an Origin (iOS, the DM service) untouched", async () => {
    const response = await fetch(`${base}/api/v1/places`);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows the bearer header on a preflight from an allowed origin", async () => {
    const response = await fetch(`${base}/api/v1/places`, {
      method: "OPTIONS",
      headers: { origin: "http://localhost:3001", "access-control-request-method": "PUT", "access-control-request-headers": "authorization" },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3001");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(response.headers.get("access-control-allow-methods")).toContain("PUT");
  });
});
