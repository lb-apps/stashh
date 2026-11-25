import { describe, expect, it } from "vitest";
import type { RecognitionQuota } from "../src/modules/billing/types.js";
import type { CreateRecognitionTaskOutcome, RecognitionRepository } from "../src/modules/recognitions/repository.js";
import { RecognitionService } from "../src/modules/recognitions/service.js";
import type { RecognitionTaskRow } from "../src/modules/recognitions/types.js";

/**
 * Stands in for `create_recognition_task`: replays a known key, and refuses once `allowance`
 * tasks exist (the database decides the real allowance and credits; see the SQL tests).
 */
class FakeRepository {
  tasks: RecognitionTaskRow[] = [];
  results: Array<{ id: string; source_url: string; places: unknown }> = [];
  allowance = Number.POSITIVE_INFINITY;
  quota: RecognitionQuota = { plan: "free", daily_limit: 3, used_today: 3, next_free_at: "2026-11-26T09:00:00+00:00", credits: 0 };

  async getRecognitionResultBySourceUrl(sourceUrl: string) {
    return this.results.find((r) => r.source_url === sourceUrl) ?? null;
  }

  async createRecognitionTask(params: {
    ownerUserId: string;
    sourceUrl: string;
    sourceMedia: unknown;
    options: unknown;
    idempotencyKey: string | null;
  }): Promise<CreateRecognitionTaskOutcome> {
    const existing = params.idempotencyKey
      ? this.tasks.find((t) => t.owner_user_id === params.ownerUserId && t.idempotency_key === params.idempotencyKey)
      : undefined;
    if (existing) return { status: "existing", task: existing };
    if (this.tasks.filter((t) => t.owner_user_id === params.ownerUserId).length >= this.allowance) {
      return { status: "quota", quota: this.quota };
    }
    const row = task({
      id: `task-${this.tasks.length + 1}`,
      owner_user_id: params.ownerUserId,
      source_url: params.sourceUrl,
      source_media: params.sourceMedia as RecognitionTaskRow["source_media"],
      options: params.options as RecognitionTaskRow["options"],
      idempotency_key: params.idempotencyKey,
      charge: "allowance",
      charge_status: "reserved",
    });
    this.tasks.push(row);
    return { status: "created", task: row };
  }
}

function task(partial: Partial<RecognitionTaskRow> & { owner_user_id: string; source_url: string }): RecognitionTaskRow {
  return {
    id: "task",
    result_id: null,
    status: "queued",
    options: {},
    started_at: null,
    finished_at: null,
    error_message: null,
    retry_count: 0,
    idempotency_key: null,
    source_media: null,
    charge: null,
    charge_status: null,
    stage: null,
    available_at: "2026-10-14T00:00:00Z",
    created_at: "2026-10-14T00:00:00Z",
    updated_at: "2026-10-14T00:00:00Z",
    ...partial,
  };
}

const OWNER = "00000000-0000-4000-8000-000000000001";
const URL = "https://www.instagram.com/reel/ABC123/?igsh=xyz";

function setup() {
  const repo = new FakeRepository();
  return { repo, service: new RecognitionService(repo as unknown as RecognitionRepository) };
}

describe("RecognitionService.getCachedResult", () => {
  it("serves an earlier result only when it found something", async () => {
    const { repo, service } = setup();
    repo.results.push(
      { id: "empty", source_url: "instagram-media:1", places: [] },
      { id: "full", source_url: "instagram-media:2", places: [{ name: "Sofyalı Meyhane" }] },
    );
    expect(await service.getCachedResult("instagram-media:1")).toBeNull();
    expect(await service.getCachedResult("instagram-media:2")).toEqual({ id: "full", places: [{ name: "Sofyalı Meyhane" }] });
    expect(await service.getCachedResult("instagram-media:3")).toBeNull();
  });
});

describe("RecognitionService.enqueueRecognition", () => {
  const CDN = "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1&signature=abc";

  it("keys a shared post and a shared story apart and records what each is", async () => {
    const { service } = setup();
    const post = await service.enqueueRecognition({
      ownerUserId: OWNER,
      source: { kind: "shared_media", provider: "instagram", format: "post", mediaId: "18000000000000002", mediaUrl: CDN, caption: "jazz" },
    });
    const story = await service.enqueueRecognition({
      ownerUserId: OWNER,
      source: { kind: "shared_media", provider: "instagram", format: "story", mediaId: "18094747109404940", mediaUrl: CDN, caption: null },
    });
    expect(post.source_url).toBe("instagram-media:18000000000000002");
    expect(post.source_media).toMatchObject({ media_url: CDN, caption: "jazz", platform: "instagram", source_type: "post" });
    expect(story.source_url).toBe("instagram-story:18094747109404940");
    expect(story.source_media).toMatchObject({ media_url: CDN, caption: null, platform: "instagram", source_type: "story" });
  });

  it("normalises the source URL and stores the idempotency key", async () => {
    const { service } = setup();
    const created = await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL }, idempotencyKey: "mid-1" });
    expect(created.source_url).toBe("https://instagram.com/reel/ABC123");
    expect(created.idempotency_key).toBe("mid-1");
  });

  it("keeps the caption a channel sent with a link, and nothing when it sent none", async () => {
    const { service } = setup();
    const withCaption = await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL, caption: "📍Ali Ustanın Yeri" } });
    const without = await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL } });
    expect(withCaption.source_media).toEqual({ caption: "📍Ali Ustanın Yeri" });
    expect(without.source_media).toBeNull();
  });

  it("returns the original task for a repeated key", async () => {
    const { repo, service } = setup();
    const first = await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL }, idempotencyKey: "mid-1" });
    const second = await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL }, idempotencyKey: "mid-1" });
    expect(second.id).toBe(first.id);
    expect(repo.tasks).toHaveLength(1);
  });

  it("creates a new task every time without a key", async () => {
    const { repo, service } = setup();
    await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL } });
    await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL } });
    expect(repo.tasks).toHaveLength(2);
  });

  it("keys a shared Instagram post by its media id and keeps its content for the worker", async () => {
    const { repo, service } = setup();
    const source = {
      kind: "shared_media" as const,
      provider: "instagram" as const,
      format: "post" as const,
      mediaId: "18008721881113680",
      mediaUrl: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1&signature=x",
      caption: "jazz clubs",
    };
    const created = await service.enqueueRecognition({ ownerUserId: OWNER, source, idempotencyKey: "mid-9" });
    expect(created.source_url).toBe("instagram-media:18008721881113680");
    expect(created.source_media).toEqual({
      media_url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1&signature=x",
      caption: "jazz clubs",
      platform: "instagram",
      source_type: "post",
    });

    const again = await service.enqueueRecognition({ ownerUserId: OWNER, source, idempotencyKey: "mid-9" });
    expect(again.id).toBe(created.id);
    expect(repo.tasks).toHaveLength(1);
  });

  it("refuses with the quota's details when nothing is left to pay with, but still replays a known key", async () => {
    const { repo, service } = setup();
    repo.allowance = 1;
    const first = await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL }, idempotencyKey: "k-1" });

    await expect(service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL } })).rejects.toMatchObject({
      status: 429,
      errorCode: "RECOGNITION_QUOTA",
      details: repo.quota,
    });
    const replay = await service.enqueueRecognition({ ownerUserId: OWNER, source: { kind: "url", url: URL }, idempotencyKey: "k-1" });
    expect(replay.id).toBe(first.id);
  });
});
