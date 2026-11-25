import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { BillingRepository } from "./repository.js";
import { BillingService } from "./service.js";

/**
 * Service role: billing tables and functions are closed to clients. Every call names the
 * person it is for, taken from a verified JWT or a service-authenticated route.
 */
export function createBillingService(): BillingService {
  return new BillingService(new BillingRepository(createSupabaseServiceClient()));
}

export function createBillingRepository(): BillingRepository {
  return new BillingRepository(createSupabaseServiceClient());
}
