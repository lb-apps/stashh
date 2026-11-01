import { config } from "../../config.js";
import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { SupabaseMagicLinkIssuer } from "./magic-link-issuer.js";
import { SignInLinkRepository } from "./repository.js";
import { SignInLinkService } from "./service.js";

export function createSignInLinkService(): SignInLinkService {
  const serviceClient = createSupabaseServiceClient();
  return new SignInLinkService(
    new SignInLinkRepository(serviceClient),
    new SupabaseMagicLinkIssuer(serviceClient),
    config.WEB_APP_URL,
  );
}
