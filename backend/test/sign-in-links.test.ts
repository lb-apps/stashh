import { describe, expect, it } from "vitest";
import { AppHttpError } from "../src/errors/appHttpError.js";
import type { MagicLinkIssuer } from "../src/modules/sign-in-links/magic-link-issuer.js";
import type { SignInLinkRepository } from "../src/modules/sign-in-links/repository.js";
import { SignInLinkService, hashSignInCode } from "../src/modules/sign-in-links/service.js";
import { signInCodeSchema } from "../src/modules/sign-in-links/types.js";

const USER = "4b6f3c1e-6f5d-5c3a-9f0e-2d1c0b9a8e7f";

class InMemoryLinks {
  rows: Array<{ userId: string; codeHash: string }> = [];
  knownUsers = new Set([USER]);
  async insert(link: { userId: string; codeHash: string }) {
    if (!this.knownUsers.has(link.userId)) throw Object.assign(new Error("fk"), { code: "23503" });
    this.rows.push(link);
  }
  async findOwner(codeHash: string) {
    return this.rows.find((r) => r.codeHash === codeHash)?.userId ?? null;
  }
}

class FakeIssuer implements MagicLinkIssuer {
  failNext = false;
  gone = false;
  calls: string[] = [];
  async issue(userId: string) {
    this.calls.push(userId);
    if (this.gone) return null;
    if (this.failNext) {
      this.failNext = false;
      throw new Error("auth down");
    }
    return `hashed-${userId}`;
  }
}

function setup() {
  const links = new InMemoryLinks();
  const issuer = new FakeIssuer();
  const service = new SignInLinkService(links as unknown as SignInLinkRepository, issuer, "https://stashh.me/app");
  return { links, issuer, service };
}

const codeOf = (url: string) => url.split("/a/")[1]!;

describe("SignInLinkService.mint", () => {
  it("returns a personal /a/<code> link, storing only the code's hash", async () => {
    const { links, service } = setup();
    const link = await service.mint(USER);

    expect(link.url).toMatch(/^https:\/\/stashh\.me\/app\/a\/[A-Za-z0-9_-]{32}$/);
    expect(signInCodeSchema.safeParse(codeOf(link.url)).success).toBe(true);
    expect(links.rows).toHaveLength(1);
    expect(links.rows[0]!.codeHash).toBe(hashSignInCode(codeOf(link.url)));
    expect(JSON.stringify(links.rows)).not.toContain(codeOf(link.url));
  });

  it("mints a different code every time", async () => {
    const { service } = setup();
    const [a, b] = await Promise.all([service.mint(USER), service.mint(USER)]);
    expect(a.url).not.toBe(b.url);
  });

  it("is a 404 for a user that does not exist", async () => {
    const { service } = setup();
    await expect(service.mint("00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ status: 404, errorCode: "USER_NOT_FOUND" });
    await expect(service.mint("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(AppHttpError);
  });
});

describe("SignInLinkService.redeem", () => {
  it("returns a magic-link token for the link's owner, every time it is opened", async () => {
    const { issuer, service } = setup();
    const code = codeOf((await service.mint(USER)).url);

    const token = { user_id: USER, token_hash: `hashed-${USER}`, type: "magiclink" };
    expect(await service.redeem(code)).toEqual(token);
    expect(await service.redeem(code)).toEqual(token);
    expect(issuer.calls).toEqual([USER, USER]);
  });

  it("keeps earlier links working after a new one is minted", async () => {
    const { service } = setup();
    const first = codeOf((await service.mint(USER)).url);
    await service.mint(USER);

    expect(await service.redeem(first)).toMatchObject({ user_id: USER });
  });

  it("refuses an unknown code", async () => {
    const { service } = setup();
    await service.mint(USER);

    expect(await service.redeem("x".repeat(32))).toBeNull();
  });

  it("refuses a link whose owner is gone", async () => {
    const { issuer, service } = setup();
    const code = codeOf((await service.mint(USER)).url);

    issuer.gone = true;
    expect(await service.redeem(code)).toBeNull();
  });

  it("leaves the link usable when Auth fails to issue the token", async () => {
    const { issuer, service } = setup();
    const code = codeOf((await service.mint(USER)).url);

    issuer.failNext = true;
    await expect(service.redeem(code)).rejects.toThrow("auth down");
    expect(await service.redeem(code)).toMatchObject({ user_id: USER });
  });
});
