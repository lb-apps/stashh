import { describe, expect, it } from "vitest";
import { CATEGORY_GROUPS, categoryGroup } from "../src/modules/places/mapper.js";

describe("categoryGroup", () => {
  it.each([
    ["coffee_shop", null, "coffee"],
    ["cafe", null, "coffee"],
    ["turkish_restaurant", null, "food"],
    ["restaurant", null, "food"],
    ["wine_bar", null, "wine"],
    ["cocktail_bar", null, "bar"],
    ["bakery", null, "bakery"],
    ["dessert_restaurant", null, "sweets"],
    ["ice_cream_shop", null, "sweets"],
    ["park", null, "park"],
    ["observation_deck", null, "view"],
    ["farmers_market", null, "market"],
  ])("maps primary type %s to %s", (category, types, group) => {
    expect(categoryGroup(category, types)).toBe(group);
  });

  it("lets the primary type decide over the other types", () => {
    expect(categoryGroup("bakery", ["cafe", "bakery", "food"])).toBe("bakery");
  });

  it("falls back to the other types, in Google's order, when the primary type has no group", () => {
    expect(categoryGroup("establishment", ["point_of_interest", "bar", "restaurant"])).toBe("bar");
    expect(categoryGroup(null, ["meal_takeaway"])).toBe("food");
  });

  it("is default when nothing fits", () => {
    expect(categoryGroup(null, null)).toBe("default");
    expect(categoryGroup("hotel", ["lodging"])).toBe("default");
    expect(categoryGroup("clothing_store", "not-an-array")).toBe("default");
  });

  it("only ever returns a declared group", () => {
    for (const type of ["coffee_shop", "pub", "x", "sushi_restaurant", "garden"]) {
      expect(CATEGORY_GROUPS).toContain(categoryGroup(type, null));
    }
  });
});
