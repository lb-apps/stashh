import { config } from "../../config.js";
import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { SupabaseAuthUserAdmin } from "./auth-user-admin.js";
import { ChannelIdentityRepository } from "./repository.js";
import { ChannelIdentityService } from "./service.js";

export function createChannelIdentityService(): ChannelIdentityService {
  const serviceClient = createSupabaseServiceClient();
  return new ChannelIdentityService(
    new ChannelIdentityRepository(serviceClient),
    new SupabaseAuthUserAdmin(serviceClient),
    config.CHANNEL_IDENTITY_EMAIL_DOMAIN,
  );
}
