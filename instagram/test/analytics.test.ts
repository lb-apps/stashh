import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { createAnalytics, HttpMixpanel, NoopAnalytics } from "../src/analytics/mixpanel.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const USER = "00000000-0000-4000-8000-000000000001";
const AT = { userId: USER, time: new Date("2026-11-12T10:00:00.000Z"), key: "mid-1" };

/** A fetch that records each request and answers with the given responses in turn (default: accepted). */
function recordingFetch(...answers: Array<Response | Error>) {
  const calls: Array<{ url: string; init: RequestInit; records: Array<Record<string, any>> }> = [];
  const fetch = (async (url: string | URL, init: RequestInit = {}) => {
    const data = new URLSearchParams(String(init.body)).get("data") ?? "[]";
    calls.push({ url: String(url), init, records: JSON.parse(data) });
    const answer = answers.shift() ?? Response.json({ status: 1, error: null });
    if (answer instanceof Error) throw answer;
    return answer;
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

/** A logger that keeps what it was asked to log. */
function recordingLog() {
  const lines: Array<Record<string, unknown>> = [];
  const log = pino({ level: "warn" }, { write: (line: string) => void lines.push(JSON.parse(line)) });
  return { log, lines };
}

describe("HttpMixpanel", () => {
  it("sends an event to the EU host on the user, without a geolocation lookup", async () => {
    const { fetch, calls } = recordingFetch();
    const mixpanel = new HttpMixpanel({ token: TOKEN, appEnv: "production", log: pino({ level: "silent" }), fetch });

    mixpanel.track("recognition_completed", { entry: "dm_share", source_type: "reel", place_count: 3, duration_ms: 41_000 }, AT);
    await mixpanel.flush();

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe("https://api-eu.mixpanel.com/track?verbose=1&ip=0");
    expect(call?.init.method).toBe("POST");
    expect(call?.records).toEqual([
      {
        event: "recognition_completed",
        properties: {
          entry: "dm_share",
          source_type: "reel",
          place_count: 3,
          duration_ms: 41_000,
          token: TOKEN,
          distinct_id: USER,
          $user_id: USER,
          time: AT.time.getTime(),
          $insert_id: expect.stringMatching(/^[0-9a-f]{32}$/),
          app_env: "production",
        },
      },
    ]);
  });

  it("gives the same moment the same insert id, and another event or message another one", async () => {
    const { fetch, calls } = recordingFetch();
    const mixpanel = new HttpMixpanel({ token: TOKEN, appEnv: "production", log: pino({ level: "silent" }), fetch });
    const props = { entry: "dm_link", source_type: "tiktok" } as const;

    mixpanel.track("recognition_started", props, AT);
    mixpanel.track("recognition_started", props, AT);
    mixpanel.track("recognition_started", props, { ...AT, key: "mid-2" });
    mixpanel.track("recognition_failed", { ...props, reason: "error", duration_ms: 1 }, AT);
    await mixpanel.flush();

    const ids = calls.map((c) => c.records[0]?.properties.$insert_id);
    expect(ids[0]).toBe(ids[1]);
    expect(new Set(ids).size).toBe(3);
  });

  it("names a new profile with the IP lookup off, and never blanks a missing value", async () => {
    const { fetch, calls } = recordingFetch();
    const mixpanel = new HttpMixpanel({ token: TOKEN, appEnv: "production", log: pino({ level: "silent" }), fetch });
    const createdAt = new Date("2026-11-12T10:00:00.000Z");

    mixpanel.setProfile(USER, { name: "Ayşe", instagramUsername: "ayse.k", createdAt });
    mixpanel.setProfile(USER, { name: null, instagramUsername: null, createdAt });
    await mixpanel.flush();

    expect(calls.map((c) => c.url)).toEqual(["https://api-eu.mixpanel.com/engage?verbose=1&ip=0", "https://api-eu.mixpanel.com/engage?verbose=1&ip=0"]);
    const profile = { $token: TOKEN, $distinct_id: USER, $ip: "0" };
    expect(calls[0]?.records).toEqual([
      { ...profile, $set_once: { $created: "2026-11-12T10:00:00.000Z" } },
      { ...profile, $set: { $name: "Ayşe", instagram_username: "ayse.k" } },
    ]);
    expect(calls[1]?.records).toEqual([{ ...profile, $set_once: { $created: "2026-11-12T10:00:00.000Z" } }]);
  });

  it("deletes a profile", async () => {
    const { fetch, calls } = recordingFetch();
    const mixpanel = new HttpMixpanel({ token: TOKEN, appEnv: "production", log: pino({ level: "silent" }), fetch });

    mixpanel.deleteProfile(USER);
    await mixpanel.flush();

    expect(calls[0]?.records).toEqual([{ $token: TOKEN, $distinct_id: USER, $ip: "0", $delete: "" }]);
  });

  it("never throws, and logs a failed send with the event name and status only", async () => {
    const { fetch } = recordingFetch(
      new TypeError("fetch failed"),
      new Response("Bad Gateway", { status: 502 }),
      Response.json({ status: 0, error: "token, missing or empty" }),
    );
    const { log, lines } = recordingLog();
    const mixpanel = new HttpMixpanel({ token: TOKEN, appEnv: "production", log, fetch });
    const props = { entry: "dm_share", source_type: "reel" } as const;

    expect(() => {
      mixpanel.track("recognition_started", props, AT);
      mixpanel.track("recognition_started", props, AT);
      mixpanel.track("recognition_started", props, AT);
    }).not.toThrow();
    await mixpanel.flush();

    expect(lines.map(({ event, status, reason, error, msg }) => ({ event, status, reason, error, msg }))).toEqual([
      { event: "recognition_started", status: undefined, reason: "TypeError", error: undefined, msg: "analytics not sent" },
      { event: "recognition_started", status: 502, reason: undefined, error: null, msg: "analytics not accepted" },
      { event: "recognition_started", status: 200, reason: undefined, error: "token, missing or empty", msg: "analytics not accepted" },
    ]);
    const logged = JSON.stringify(lines);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(USER);
  });
});

describe("createAnalytics", () => {
  it("sends nothing without a token", async () => {
    const analytics = createAnalytics({ token: undefined, appEnv: "development", log: pino({ level: "silent" }) });
    expect(analytics).toBeInstanceOf(NoopAnalytics);
    analytics.track("user_signed_up", {}, AT);
    await analytics.flush();
  });

  it("uses Mixpanel when a token is set", () => {
    expect(createAnalytics({ token: TOKEN, appEnv: "development", log: pino({ level: "silent" }) })).toBeInstanceOf(HttpMixpanel);
  });
});
