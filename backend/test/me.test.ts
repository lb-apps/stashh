import { describe, expect, it } from "vitest";
import type { MeRepository, ProfileRows } from "../src/modules/me/repository.js";
import { MeService } from "../src/modules/me/service.js";

const service = (rows: ProfileRows) => new MeService({ getProfileRows: async () => rows } as unknown as MeRepository);

describe("MeService.getMe", () => {
  it("shows the Instagram name and username the account is linked to", async () => {
    const me = await service({
      user: { created_at: "2026-10-14T08:00:00Z" },
      instagram: { username: "emir.erdo", display_name: "Emir" },
      savedCount: 12,
    }).getMe("user-1");
    expect(me).toEqual({ user_id: "user-1", display_name: "Emir", instagram_username: "emir.erdo", created_at: "2026-10-14T08:00:00Z", saved_count: 12 });
  });

  it("has no Instagram fields for an account not linked to Instagram", async () => {
    const me = await service({ user: { created_at: "2026-04-09T08:00:00Z" }, instagram: null, savedCount: 0 }).getMe("user-2");
    expect(me).toMatchObject({ display_name: null, instagram_username: null, saved_count: 0 });
  });

  it("is a 404 when the account is gone", async () => {
    await expect(service({ user: null, instagram: null, savedCount: 0 }).getMe("user-3")).rejects.toMatchObject({ status: 404 });
  });
});
