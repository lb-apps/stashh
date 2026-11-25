import { describe, expect, it } from "vitest";
import { AppHttpError } from "../src/errors/appHttpError.js";
import { executeTool, recentRecognitions, REPLY_LIMITS, replySchema, toolDefinitions, type ToolContext, type ToolServices } from "../src/modules/assistant/tools.js";

const USER = "00000000-0000-4000-8000-000000000001";
const LIST = "11111111-1111-4111-8111-111111111111";
const PLACE_A = "22222222-2222-4222-8222-222222222222";
const PLACE_B = "33333333-3333-4333-8333-333333333333";

function services(overrides: Partial<ToolServices> = {}): ToolServices {
  const fail = async (): Promise<never> => {
    throw new Error("not expected in this test");
  };
  return {
    lists: { listLists: fail, listPlaces: fail, createList: fail, updateList: fail, deleteList: fail, addPlace: fail, removePlaceByPlaceId: fail },
    places: { getSavedPlace: fail, deleteSavedPlace: fail, markVisited: fail, clearVisited: fail, listSavedPlaces: fail },
    placesRepo: { searchSavedPlaces: fail, getSavedPlacesByPlaceIds: fail, getPlacesByGoogleIds: fail, countSavedPlaces: fail },
    recognitions: { listRecentRecognitionsWithPlaces: fail },
    signInLinks: { mint: fail },
    billing: { status: fail },
    ...overrides,
  } as ToolServices;
}

const ctx = (overrides: Partial<ToolServices> = {}): ToolContext => ({ userId: USER, services: services(overrides) });

describe("tool definitions", () => {
  it("are OpenAI function definitions with JSON-schema parameters, reply last", () => {
    const definitions = toolDefinitions();
    expect(definitions.at(-1)?.function.name).toBe("reply");
    for (const definition of definitions) {
      expect(definition.type).toBe("function");
      expect(definition.function.description.length).toBeGreaterThan(10);
      expect(definition.function.parameters).toMatchObject({ type: "object" });
      expect(definition.function.parameters).not.toHaveProperty("$schema");
    }
    const names = definitions.map((d) => d.function.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps the same order on every call, so the cached prefix stays identical", () => {
    expect(JSON.stringify(toolDefinitions())).toBe(JSON.stringify(toolDefinitions()));
  });
});

describe("reply schema", () => {
  it("enforces Instagram's limits", () => {
    expect(replySchema.safeParse({ text: "ok" }).success).toBe(true);
    expect(replySchema.safeParse({ text: "x".repeat(REPLY_LIMITS.textChars + 1) }).success).toBe(false);
    expect(replySchema.safeParse({ text: "ok", quick_replies: Array.from({ length: 14 }, (_, i) => ({ title: `q${i}` })) }).success).toBe(false);
    expect(replySchema.safeParse({ text: "ok", quick_replies: [{ title: "x".repeat(21) }] }).success).toBe(false);
    expect(replySchema.safeParse({ text: "ok", cards: { kind: "places", place_ids: Array.from({ length: 11 }, () => PLACE_A) } }).success).toBe(false);
    expect(replySchema.safeParse({ text: "ok", cards: { kind: "lists", list_ids: [LIST] } }).success).toBe(false);
    expect(replySchema.safeParse({ text: "ok", cards: { kind: "lists", list_ids: [LIST], button_title: "Gör" }, map_link: true }).success).toBe(true);
  });
});

describe("executeTool", () => {
  it("rejects an unknown tool and invalid arguments as results, not throws", async () => {
    expect(await executeTool(ctx(), "nope", {})).toMatchObject({ error: "UNKNOWN_TOOL" });
    expect(await executeTool(ctx(), "get_place", { place_id: "not-a-uuid" })).toMatchObject({ error: "INVALID_ARGUMENTS" });
  });

  it("turns an expected service error into a result", async () => {
    const result = await executeTool(
      ctx({
        places: {
          ...services().places,
          getSavedPlace: async () => {
            throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
          },
        },
      }),
      "get_place",
      { place_id: PLACE_A },
    );
    expect(result).toEqual({ error: "PLACE_NOT_FOUND", message: "Saved place not found" });
  });

  it("lets an unexpected error through", async () => {
    const context = ctx({
      places: {
        ...services().places,
        getSavedPlace: async () => {
          throw new Error("database down");
        },
      },
    });
    await expect(executeTool(context, "get_place", { place_id: PLACE_A })).rejects.toThrow("database down");
  });

  it("add_to_list dedupes ids and reports duplicates instead of failing", async () => {
    const added: string[] = [];
    const context = ctx({
      lists: {
        ...services().lists,
        addPlace: async (_owner, _list, body) => {
          if (body.place_id === PLACE_B) throw new AppHttpError(409, "Place already in list", "USER_LIST_PLACE_DUPLICATE");
          added.push(body.place_id);
          return { list_place_id: "lp", list_id: LIST, place_id: body.place_id, created_at: "now" };
        },
      },
    });
    const result = await executeTool(context, "add_to_list", { list_id: LIST, place_ids: [PLACE_A, PLACE_A, PLACE_B] });
    expect(added).toEqual([PLACE_A]);
    expect(result).toEqual({ added: [PLACE_A], already_in_list: [PLACE_B], failed: [] });
  });

  it("create_list passes deduped place ids and returns the list", async () => {
    let received: string[] | undefined;
    const context = ctx({
      lists: {
        ...services().lists,
        createList: async (_owner, body) => {
          received = body.place_ids;
          return { id: LIST, title: body.title, description: null, emoji: body.emoji ?? null, cover_category: null, created_at: "t", updated_at: "t", place_count: received?.length ?? 0 };
        },
      },
    });
    const result = await executeTool(context, "create_list", { title: "İzmir", emoji: "🌊", place_ids: [PLACE_A, PLACE_A] });
    expect(received).toEqual([PLACE_A]);
    expect(result).toEqual({ list_id: LIST, title: "İzmir", emoji: "🌊", place_count: 1 });
  });

  it("search_saved_places searches by words, else lists recent with filters", async () => {
    const calls: string[] = [];
    const context = ctx({
      placesRepo: {
        ...services().placesRepo,
        searchSavedPlaces: async (_owner, query) => {
          calls.push(`search:${query}`);
          return [];
        },
      },
      places: {
        ...services().places,
        listSavedPlaces: async (_owner, query) => {
          calls.push(`list:${query.district ?? ""}:${query.category ?? ""}`);
          return { data: { items: [], total_count: 0 }, pagination: { limit: 10, next_cursor: null, has_more: false } };
        },
      },
    });
    await executeTool(context, "search_saved_places", { query: "kahve" });
    await executeTool(context, "search_saved_places", { district: "Kadıköy", category: "cafe" });
    expect(calls).toEqual(["search:kahve", "list:Kadıköy:cafe"]);
  });
});

describe("recentRecognitions", () => {
  it("maps result places to canonical ids and keeps unmatched names", async () => {
    const context = ctx({
      recognitions: {
        listRecentRecognitionsWithPlaces: async () => [
          {
            id: "r1",
            status: "completed",
            source_url: "https://www.instagram.com/reel/x/",
            created_at: "2026-11-04T10:00:00Z",
            finished_at: "2026-11-04T10:01:00Z",
            result: { source_type: "reel", author_username: "izmirdeyiz", places: [{ google_place_id: "g1", name: "Ali Usta" }, { google_place_id: "g2", name: "Kahve Dünyası" }] },
          },
        ],
      },
      placesRepo: {
        ...services().placesRepo,
        getPlacesByGoogleIds: async (ids) => {
          expect(ids).toEqual(["g1", "g2"]);
          return [{ google_place_id: "g1", id: PLACE_A } as never];
        },
      },
    });
    const result = await recentRecognitions(context, 3);
    expect(result).toEqual([
      {
        recognition_id: "r1",
        at: "2026-11-04T10:01:00Z",
        source_type: "reel",
        author_username: "izmirdeyiz",
        places: [
          { place_id: PLACE_A, name: "Ali Usta" },
          { place_id: null, name: "Kahve Dünyası" },
        ],
      },
    ]);
  });
});

describe("get_plan", () => {
  const status = {
    plan: "free" as const,
    plan_source: "default" as const,
    plan_expires_at: null,
    store: null,
    daily_limit: 3,
    used_today: 3,
    plan_limits: { free: 3, premium: 50 },
    next_free_at: new Date(Date.now() + 90 * 60_000).toISOString(),
    credits: 2,
    mock_purchases: false,
    tasks: [
      { task: "first_list" as const, credits: 3, done: true },
      { task: "first_web_visit" as const, credits: 3, done: false },
    ],
  };

  it("reads the person's plan, allowance and credits, and only the tasks still open, in words the model can say", async () => {
    const result = await executeTool(ctx({ billing: { status: async (userId: string) => (userId === USER ? status : Promise.reject(new Error("wrong user"))) } }), "get_plan", {});
    expect(result).toEqual({
      plan: "free",
      premium_until: null,
      free_analyses_per_24h: 3,
      used_in_last_24h: 3,
      next_free_analysis_in_minutes: expect.any(Number),
      credits: 2,
      daily_analyses_by_plan: { free: 3, premium: 50 },
      credit_tasks_open: [{ how: "open their map on the web for the first time", credits: 3 }],
    });
  });

  it("says when the next free analysis comes back in minutes, never as a clock time", async () => {
    const result = (await executeTool(ctx({ billing: { status: async () => status } }), "get_plan", {})) as { next_free_analysis_in_minutes: number };
    expect(result.next_free_analysis_in_minutes).toBeGreaterThanOrEqual(89);
    expect(result.next_free_analysis_in_minutes).toBeLessThanOrEqual(90);
    expect(await executeTool(ctx({ billing: { status: async () => ({ ...status, next_free_at: null }) } }), "get_plan", {})).toMatchObject({ next_free_analysis_in_minutes: null });
  });

  it("says until when Premium runs only for someone on it", async () => {
    const premium = { ...status, plan: "premium" as const, plan_source: "revenuecat" as const, plan_expires_at: "2026-12-25T17:32:49+00:00", daily_limit: 50 };
    expect(await executeTool(ctx({ billing: { status: async () => premium } }), "get_plan", {})).toMatchObject({ plan: "premium", premium_until: "2026-12-25T17:32:49+00:00" });
    const lapsed = { ...status, plan_expires_at: "2026-10-01T00:00:00+00:00" };
    expect(await executeTool(ctx({ billing: { status: async () => lapsed } }), "get_plan", {})).toMatchObject({ plan: "free", premium_until: null });
  });

  it("has no way to change a plan or credits", () => {
    const names = toolDefinitions().map((definition) => definition.function.name);
    expect(names.filter((name) => /plan|credit|billing|premium|purchase/i.test(name))).toEqual(["get_plan"]);
  });
});
