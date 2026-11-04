import { describe, expect, it } from "vitest";
import { detectLanguage, languageHintLine } from "../src/modules/assistant/language.js";

describe("detectLanguage", () => {
  it("reads Turkish from its letters or its words", () => {
    expect(detectLanguage("listelerim neler")).toBe("Turkish");
    expect(detectLanguage("naber")).toBe("Turkish");
    expect(detectLanguage("son reel'deki mekanlar?")).toBe("Turkish");
    expect(detectLanguage("Kadıköy")).toBe("Turkish");
  });

  it("reads English from its words, place names aside", () => {
    expect(detectLanguage("what did I save in Kadikoy?")).toBe("English");
    expect(detectLanguage("show me my lists")).toBe("English");
    expect(detectLanguage("what is stashh")).toBe("English");
  });

  it("gives no hint when it cannot tell", () => {
    expect(detectLanguage("ok")).toBeNull();
    expect(detectLanguage("👍")).toBeNull();
    expect(detectLanguage("Forno Di Roma")).toBeNull();
    expect(languageHintLine("ok")).toBeNull();
  });
});
