import { config } from "../../config.js";
import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { BillingRepository } from "./repository.js";
import { RevenueCatClient } from "./revenuecat.js";
import { BillingService, type RevenueCatAccess } from "./service.js";

/** RevenueCat access from the environment, or null while purchases are not set up. */
function revenueCatAccess(): RevenueCatAccess | null {
  const revenueCat = config.revenueCat;
  if (!revenueCat) return null;
  return {
    customers: new RevenueCatClient(revenueCat.projectId, revenueCat.secretKey),
    environments: revenueCat.environments,
  };
}

/**
 * Service role: billing tables and functions are closed to clients. Every call names the
 * person it is for, taken from a verified JWT, a service-authenticated route or a verified
 * RevenueCat webhook.
 */
export function createBillingService(): BillingService {
  return new BillingService(new BillingRepository(createSupabaseServiceClient()), revenueCatAccess());
}

export function createBillingRepository(): BillingRepository {
  return new BillingRepository(createSupabaseServiceClient());
}
