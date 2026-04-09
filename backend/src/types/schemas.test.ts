import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  recognitionPipelineBodySchema,
  recognitionStreamQuerySchema,
  instagramUrlFieldSchema,
} from "./schemas.js";

const validReel = "https://www.instagram.com/reel/AbCdEfGhIjK/";

describe("instagramUrlFieldSchema", () => {
  it("accepts reel path", () => {
    assert.doesNotThrow(() => instagramUrlFieldSchema.parse(validReel));
  });

  it("rejects non-Instagram host", () => {
    assert.throws(() =>
      instagramUrlFieldSchema.parse("https://example.com/reel/x/"),
    );
  });

  it("rejects feed-only paths", () => {
    assert.throws(() =>
      instagramUrlFieldSchema.parse("https://www.instagram.com/explore/tags/foo/"),
    );
  });
});

describe("recognitionPipelineBodySchema", () => {
  it("matches POST /recognitions/pipeline body shape", () => {
    const r = recognitionPipelineBodySchema.safeParse({ instagram_url: validReel });
    assert.equal(r.success, true);
  });
});

describe("recognitionStreamQuerySchema", () => {
  it("matches GET /recognitions/stream query shape", () => {
    const r = recognitionStreamQuerySchema.safeParse({ url: validReel });
    assert.equal(r.success, true);
  });
});
