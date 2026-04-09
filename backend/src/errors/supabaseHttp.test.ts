import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PostgrestError } from "@supabase/supabase-js";
import { mapSupabaseErrorToHttp, isPostgrestError } from "./supabaseHttp.js";

function makePg(code: string): PostgrestError {
  return { code, message: "test", details: "", hint: "" };
}

describe("isPostgrestError", () => {
  it("returns true for PostgREST-shaped errors", () => {
    assert.equal(isPostgrestError(makePg("23505")), true);
  });

  it("returns false for plain objects", () => {
    assert.equal(isPostgrestError({ foo: 1 }), false);
  });
});

describe("mapSupabaseErrorToHttp", () => {
  it("maps unique violation to 409", () => {
    const r = mapSupabaseErrorToHttp(makePg("23505"));
    assert.equal(r.status, 409);
    assert.equal(r.body.error_code, "CONFLICT");
  });

  it("maps RLS to 403", () => {
    const r = mapSupabaseErrorToHttp(makePg("42501"));
    assert.equal(r.status, 403);
    assert.equal(r.body.error_code, "FORBIDDEN");
  });

  it("returns 500 for unknown throwables", () => {
    const r = mapSupabaseErrorToHttp(new Error("boom"));
    assert.equal(r.status, 500);
    assert.equal(r.body.error_code, "INTERNAL");
  });
});
