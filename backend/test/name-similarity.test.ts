import { describe, expect, it } from "vitest";
import { nameSimilarity, normalizeName } from "../src/modules/recognitions/name-similarity.js";

describe("normalizeName", () => {
  it("folds case and marks in any script", () => {
    expect(normalizeName("Café Göktürk")).toBe("cafe gokturk");
    expect(normalizeName("ΡΑΝΤΙΚΑΛ kitchen")).toBe("ραντικαλ kitchen");
    expect(normalizeName("Straße Bäckerei")).toBe("straße backerei");
    expect(normalizeName("مطعم البيت")).toBe("مطعم البيت");
    expect(normalizeName("築地 寿司大")).toBe("築地 寿司大");
  });

  it("collapses Turkish dotted and dotless I so a post and a listing agree", () => {
    expect(normalizeName("İstanbul Iğdır")).toBe("istanbul igdir");
    expect(normalizeName("SOFYALI")).toBe("sofyali");
    expect(normalizeName("Istanbul")).toBe(normalizeName("İstanbul"));
  });

  it("drops punctuation and collapses spaces", () => {
    expect(normalizeName("MAC&CHEESE")).toBe("mac cheese");
    expect(normalizeName("  Sofyalı Sk. No:9 ")).toBe("sofyali sk no 9");
  });
});

describe("nameSimilarity", () => {
  it("is 1 for the same name in different casing or accents", () => {
    expect(nameSimilarity("Forno di Roma", "Forno Di Roma")).toBe(1);
    expect(nameSimilarity("Ραντικαλ Kitchen", "ΡΑΝΤΙΚΑΛ kitchen")).toBe(1);
  });

  it("accepts a listing that appends a district or a descriptor", () => {
    expect(nameSimilarity("Sofyalı", "Sofyalı 9")).toBeGreaterThanOrEqual(0.8);
    expect(nameSimilarity("Bravo", "Bravo Coffee Roastery")).toBeGreaterThanOrEqual(0.8);
    expect(nameSimilarity("MAC&CHEESE", "Mac and Cheese Istanbul")).toBeGreaterThanOrEqual(0.8);
    expect(nameSimilarity("Swalk Coffee", "Swalk Coffee Altunizade")).toBeGreaterThanOrEqual(0.8);
    expect(nameSimilarity("Grasidi", "Grasidi Meyhane")).toBeGreaterThanOrEqual(0.8);
  });

  it("rejects a different business that only shares its address or landlord", () => {
    expect(nameSimilarity("Touché", "Zorlu Performing Arts Center")).toBeLessThan(0.4);
    expect(nameSimilarity("Ritmo", "Arkestra")).toBeLessThan(0.4);
    expect(nameSimilarity("Sup", "Super Burger")).toBeLessThan(0.6);
    expect(nameSimilarity("The Chicken Club", "The Peninsula Istanbul")).toBeLessThan(0.6);
  });

  it("compares scripts without word boundaries by character bigrams", () => {
    expect(nameSimilarity("築地寿司大", "築地 寿司大 本店")).toBeGreaterThanOrEqual(0.7);
    expect(nameSimilarity("寿司大", "ラーメン二郎")).toBeLessThan(0.4);
  });

  it("is 0 for empty names", () => {
    expect(nameSimilarity("", "Sofyalı 9")).toBe(0);
    expect(nameSimilarity("...", "Sofyalı 9")).toBe(0);
  });
});
