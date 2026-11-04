/**
 * Runs one DM assistant turn for the dev test user and prints the plan, the steps, the tools,
 * the tokens (cached tokens > 0 on the second run proves the prompt cache) and the cost.
 *
 *   npm run assistant:turn -- "listelerim neler"
 *   npm run assistant:turn -- --user <uuid> "what did I save last?"
 *   npm run assistant:turn -- --tap "Listeye koy" ADD_TO_LIST:<recognition_id>
 *
 * Reads the backend's environment (`.env`); needs OPENROUTER_API_KEY, SUPABASE_SECRET_KEY and,
 * without --user, DEV_TEST_EMAIL / DEV_TEST_PASSWORD. Writes real rows (turns, messages, lists).
 */
import { randomUUID } from "node:crypto";
import { signInDevTestUser } from "../src/lib/devSupabasePasswordSignIn.js";
import { createAssistantService } from "../src/modules/assistant/factory.js";
import type { InboundTurnMessage } from "../src/modules/assistant/types.js";

const args = process.argv.slice(2);
let userId: string | undefined;
let tapped: { title: string; payload: string } | undefined;
const texts: string[] = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg === "--user") userId = args[++i];
  else if (arg === "--tap") tapped = { title: args[++i] ?? "", payload: args[++i] ?? "" };
  else texts.push(arg);
}

if (!userId) {
  const auth = await signInDevTestUser();
  if (!auth.ok) throw new Error(`dev test user sign-in failed: ${auth.error}${"message" in auth && auth.message ? ` (${auth.message})` : ""}`);
  const payload = JSON.parse(Buffer.from(auth.access_token.split(".")[1]!, "base64url").toString("utf8")) as { sub: string };
  userId = payload.sub;
}

const messages: InboundTurnMessage[] = tapped
  ? [{ external_id: `script:${randomUUID()}`, text: tapped.title, tapped }]
  : texts.map((text) => ({ external_id: `script:${randomUUID()}`, text }));
if (messages.length === 0) throw new Error("say something: npm run assistant:turn -- \"listelerim neler\"");

const startedAt = Date.now();
const plan = await (await createAssistantService()).turn({ userId, channel: "instagram", messages });
console.log(JSON.stringify(plan, null, 2));
console.log(`\nturn took ${Date.now() - startedAt} ms; usage is in assistant_turns (newest row for user ${userId})`);
process.exit(0);
