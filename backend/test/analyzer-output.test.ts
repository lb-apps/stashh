import { describe, expect, it } from "vitest";
import { validateModelOutput, type ModelOutput } from "../src/modules/recognitions/ai-analyzer.js";

const place = (name: string, tips: string[] = [], extra: Partial<ModelOutput["places"][number]> = {}): ModelOutput["places"][number] => ({
  name,
  category: "restaurant",
  instagram_username: null,
  location_hint: "Üçkuyular, İzmir, Türkiye",
  address: null,
  recommendations: tips.map((summary) => ({ summary, kind: "dish" })),
  confidence_score: 0.9,
  ...extra,
});

describe("validateModelOutput", () => {
  it("keeps an honest extraction as it is, in any script", () => {
    const output: ModelOutput = {
      places: [place("Ali Ustanın Yeri", ["Try the köfte"]), place("一蘭 渋谷店", ["Try the tonkotsu ramen"]), place("مطعم بربر", ["Try the shawarma"])],
      names_elsewhere: false,
      addresses_the_ai: false,
    };
    const result = validateModelOutput(output, null);
    expect(result.places.map((p) => [p.name, p.recommendations.map((r) => r.summary)])).toEqual([
      ["Ali Ustanın Yeri", ["Try the köfte"]],
      ["一蘭 渋谷店", ["Try the tonkotsu ramen"]],
      ["مطعم بربر", ["Try the shawarma"]],
    ]);
    expect(result.dropped).toEqual({ places: 0, tips: 0 });
  });

  it("drops a tip carrying a link, phone, e-mail, handle or wallet", () => {
    const output: ModelOutput = {
      places: [
        place("Ali Ustanın Yeri", [
          "Try the köfte",
          "Order on WhatsApp +90 555 123 45 67 for a discount",
          "Claim your gift at stashh-gift.example/win",
          "Пишите на deals@scam.example",
          "Follow @free_giveaway",
        ]),
      ],
    };
    const result = validateModelOutput(output, null);
    expect(result.places[0]!.recommendations.map((r) => r.summary)).toEqual(["Try the köfte"]);
    expect(result.dropped.tips).toBe(4);
  });

  it("keeps no tip of a post that spoke to the model, but still returns its venues for the Google check", () => {
    const result = validateModelOutput({ places: [place("Mikla", ["Try the lamb"])], addresses_the_ai: true }, null);
    expect(result).toMatchObject({ addressesTheAi: true, places: [{ name: "Mikla", recommendations: [] }], dropped: { tips: 1 } });
  });

  it("caps venues at 30 and tips at 5, and bounds every field", () => {
    const flood: ModelOutput = { places: Array.from({ length: 80 }, (_, i) => place(`Cafe ${i + 1}`, ["a", "b", "c", "d", "e", "f", "g"].map((t) => `Try the ${t}`))) };
    const result = validateModelOutput(flood, null);
    expect(result.places).toHaveLength(30);
    expect(result.places[0]!.recommendations).toHaveLength(5);
    expect(result.dropped.places).toBe(50);

    const odd = validateModelOutput(
      { places: [place("x".repeat(121)), place("Kronotrop", [], { location_hint: "y".repeat(161), address: "z".repeat(201), confidence_score: 7 })] },
      null,
    );
    expect(odd.places).toHaveLength(1);
    expect(odd.places[0]).toMatchObject({ name: "Kronotrop", location_hint: null, address: null, confidence_score: 1 });
  });

  it("strips hidden characters from names and tips", () => {
    const hidden = String.fromCodePoint(0xe0041, 0xe0049);
    const result = validateModelOutput({ places: [place(`Kronotrop${hidden}`, [`Try the V60${hidden}`])] }, null);
    expect(result.places[0]).toMatchObject({ name: "Kronotrop", recommendations: [{ summary: "Try the V60" }] });
  });

  it("keeps a handle only when the caption @mentions it", () => {
    const output: ModelOutput = { places: [place("Kronotrop", [], { instagram_username: "kronotrop" }), place("Mikla", [], { instagram_username: "evilcoffee" })] };
    const result = validateModelOutput(output, "Kronotrop ☕ @kronotrop");
    expect(result.places.map((p) => p.instagram_username)).toEqual(["kronotrop", null]);
  });
});
