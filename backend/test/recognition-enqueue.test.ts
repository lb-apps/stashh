import { describe, expect, it } from "vitest";
import type { RecognitionRepository } from "../src/modules/recognitions/repository.js";
import { RecognitionService } from "../src/modules/recognitions/service.js";
import type { RecognitionTaskInsert, RecognitionTaskRow } from "../src/modules/recognitions/types.js";

class FakeRepository {
  tasks: RecognitionTaskRow[] = [];
  /** Simulates another request inserting the same key between our read and our write. */
  raceOnNextInsert: RecognitionTaskRow | null = null;

  async getRecognitionByIdempotencyKey(owner: string, key: string) {
    return this.tasks.find((t) => t.owner_user_id === owner && t.idempotency_key === key) ?? null;
  }

  async createQueuedRecognition(insert: RecognitionTaskInsert): Promise<RecognitionTaskRow> {
    if (this.raceOnNextInsert) {
      this.tasks.push(this.raceOnNextInsert);
      this.raceOnNextInsert = null;
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    const row = task({ ...insert, id: `task-${this.tasks.length + 1}` });
    this.tasks.push(row);
    return row;
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

describe("RecognitionService.enqueueRecognition", () => {
  it("normalises the source URL and stores the idempotency key", async () => {
    const { service } = setup();
    const created = await service.enqueueRecognition({ ownerUserId: OWNER, sourceUrl: URL, idempotencyKey: "mid-1" });
    expect(created.source_url).toBe("https://instagram.com/reel/ABC123");
    expect(created.idempotency_key).toBe("mid-1");
  });

  it("returns the original task for a repeated key", async () => {
    const { repo, service } = setup();
    const first = await service.enqueueRecognition({ ownerUserId: OWNER, sourceUrl: URL, idempotencyKey: "mid-1" });
    const second = await service.enqueueRecognition({ ownerUserId: OWNER, sourceUrl: URL, idempotencyKey: "mid-1" });
    expect(second.id).toBe(first.id);
    expect(repo.tasks).toHaveLength(1);
  });

  it("returns the winner when a concurrent request inserts the same key first", async () => {
    const { repo, service } = setup();
    repo.raceOnNextInsert = task({ id: "winner", owner_user_id: OWNER, source_url: URL, idempotency_key: "mid-2" });
    const result = await service.enqueueRecognition({ ownerUserId: OWNER, sourceUrl: URL, idempotencyKey: "mid-2" });
    expect(result.id).toBe("winner");
  });

  it("creates a new task every time without a key", async () => {
    const { repo, service } = setup();
    await service.enqueueRecognition({ ownerUserId: OWNER, sourceUrl: URL });
    await service.enqueueRecognition({ ownerUserId: OWNER, sourceUrl: URL });
    expect(repo.tasks).toHaveLength(2);
  });
});
