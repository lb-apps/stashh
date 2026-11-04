import { config } from "../../config.js";
import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { rootLogger } from "../../lib/logger.js";
import { createOpenRouterClient } from "../../lib/openrouter.js";
import { ChannelIdentityRepository } from "../identities/repository.js";
import { createListsServiceWithServiceRole } from "../lists/factory.js";
import { createPlacesServiceWithServiceRole } from "../places/factory.js";
import { PlacesRepository } from "../places/repository.js";
import { RecognitionRepository } from "../recognitions/repository.js";
import { createSignInLinkService } from "../sign-in-links/factory.js";
import { ASSISTANT_PROMPT } from "./prompt.js";
import { AssistantRepository } from "./repository.js";
import { AssistantService } from "./service.js";

const assistantLog = rootLogger.child({ module: "assistant" });

/** One model call's budget; a turn makes several, and the channel waits 60 s for the whole turn. */
const MODEL_CALL_TIMEOUT_MS = 20_000;

/** Service-role wiring for the DM assistant: every service acts for the owner named in the turn. */
export function createAssistantService(): AssistantService {
  const serviceSb = createSupabaseServiceClient();
  return new AssistantService({
    repo: new AssistantRepository(serviceSb),
    model: createOpenRouterClient({ apiKey: config.OPENROUTER_API_KEY, timeoutMs: MODEL_CALL_TIMEOUT_MS }),
    modelId: config.ASSISTANT_MODEL,
    systemPrompt: ASSISTANT_PROMPT,
    tools: {
      lists: createListsServiceWithServiceRole(),
      places: createPlacesServiceWithServiceRole(),
      placesRepo: new PlacesRepository(serviceSb, serviceSb),
      recognitions: new RecognitionRepository(serviceSb),
      signInLinks: createSignInLinkService(),
    },
    identities: new ChannelIdentityRepository(serviceSb),
    maxSteps: config.ASSISTANT_MAX_STEPS,
    dailyTurnCap: config.ASSISTANT_DAILY_TURN_CAP,
    suggestedReplies: config.ASSISTANT_SUGGESTED_REPLIES === "on",
    log: assistantLog,
  });
}
