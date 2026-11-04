import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSISTANT_PROMPT } from "../src/modules/assistant/prompt.js";
import { REPLY_TOOL, TOOLS } from "../src/modules/assistant/tools.js";

const markdown = readFileSync(new URL("../src/modules/assistant/prompt.md", import.meta.url), "utf8");

describe("assistant prompt", () => {
  it("ships the Markdown the owner edits (run `npm run assistant:prompt:build` after editing it)", () => {
    expect(ASSISTANT_PROMPT).toBe(markdown);
  });

  it("names the reply tool and the channel's button payloads", () => {
    expect(ASSISTANT_PROMPT).toContain(`\`${REPLY_TOOL}\``);
    for (const payload of ["ERASE_CONFIRM", "ADD_TO_LIST:<recognition_id>", "OPEN_MAP", "SHOW_LIST:<list_id>"]) {
      expect(ASSISTANT_PROMPT).toContain(payload);
    }
  });

  it("names the destructive tools it gates behind a confirmation", () => {
    for (const name of ["delete_list", "remove_place"]) {
      expect(TOOLS.some((tool) => tool.name === name)).toBe(true);
      expect(ASSISTANT_PROMPT).toContain(`\`${name}\``);
    }
  });

  it("carries no per-turn value, so it caches across turns and users", () => {
    expect(ASSISTANT_PROMPT).not.toMatch(/\{\{[a-z_]+\}\}/);
    expect(ASSISTANT_PROMPT).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });

  it("is long enough to be cached by the model", () => {
    // Anthropic caches prefixes of at least 512 tokens; about four characters per token.
    expect(ASSISTANT_PROMPT.length).toBeGreaterThan(512 * 4);
  });
});
