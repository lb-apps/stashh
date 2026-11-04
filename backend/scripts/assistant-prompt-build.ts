/**
 * Compiles the DM assistant's system prompt (`src/modules/assistant/prompt.md`, the file the
 * owner edits) into `prompt.ts`, which is what ships: `tsc` copies no Markdown into `dist/`.
 * A test keeps the two identical, so an edited `.md` without this step fails CI.
 *
 *   npm run assistant:prompt:build
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "../src/modules/assistant/prompt.md");
const target = join(here, "../src/modules/assistant/prompt.ts");

const markdown = readFileSync(source, "utf8");
const generated = `// Generated from prompt.md by \`npm run assistant:prompt:build\`. Edit the Markdown, not this file.
export const ASSISTANT_PROMPT: string = ${JSON.stringify(markdown)};
`;
writeFileSync(target, generated);
console.log(`prompt.ts written (${markdown.length} characters)`);
