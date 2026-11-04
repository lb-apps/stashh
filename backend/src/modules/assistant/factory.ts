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
import { AssistantRepository } from "./repository.js";
import { AssistantService } from "./service.js";
import { AssistantSettingsRepository, resolveAssistantSettings, systemPromptOf } from "./settings.js";

const assistantLog = rootLogger.child({ module: "assistant" });

/** One model call's budget; a turn makes several, and the channel waits 60 s for the whole turn. */
const MODEL_CALL_TIMEOUT_MS = 20_000;

/**
 * Service-role wiring for the DM assistant: every service acts for the owner named in the turn.
 * Built per request with the settings as they are now (the owner edits them from the dashboard).
 */
export async function createAssistantService(): Promise<AssistantService> {
  const serviceSb = createSupabaseServiceClient();
  const settings = await resolveAssistantSettings(new AssistantSettingsRepository(serviceSb));
  return new AssistantService({
    repo: new AssistantRepository(serviceSb),
    model: createOpenRouterClient({ apiKey: config.OPENROUTER_API_KEY, timeoutMs: MODEL_CALL_TIMEOUT_MS }),
    modelId: settings.model,
    systemPrompt: systemPromptOf(settings),
    tools: {
      lists: createListsServiceWithServiceRole(),
      places: createPlacesServiceWithServiceRole(),
      placesRepo: new PlacesRepository(serviceSb, serviceSb),
      recognitions: new RecognitionRepository(serviceSb),
      signInLinks: createSignInLinkService(),
    },
    identities: new ChannelIdentityRepository(serviceSb),
    maxSteps: settings.maxSteps,
    dailyTurnCap: settings.dailyTurnCap,
    suggestedReplies: settings.suggestedReplies,
    enabled: settings.enabled,
    log: assistantLog,
  });
}
