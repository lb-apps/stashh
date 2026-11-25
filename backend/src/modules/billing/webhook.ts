import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../../http/response.js";
import { rootLogger } from "../../lib/logger.js";
import type { BillingService } from "./service.js";

/**
 * RevenueCat's webhook. An event only says *that* a customer changed; the handler then syncs
 * each person it names from RevenueCat's current state, so a duplicate, late or out-of-order
 * event is harmless and nothing needs to be stored. It answers `200` once the sync is done and an
 * error when it fails, so RevenueCat retries.
 * https://www.revenuecat.com/docs/integrations/webhooks
 */

const uuid = z.string().uuid();

const webhookSchema = z.object({
  event: z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    environment: z.string().optional(),
    app_user_id: z.string().optional(),
    original_app_user_id: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    transferred_from: z.array(z.string()).optional(),
    transferred_to: z.array(z.string()).optional(),
  }),
});
export type RevenueCatWebhookEvent = z.infer<typeof webhookSchema>["event"];

/** The Stashh people an event is about: every id it names that is a Supabase user id. */
export function eventUserIds(event: RevenueCatWebhookEvent): string[] {
  const ids = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
    ...(event.transferred_from ?? []),
    ...(event.transferred_to ?? []),
  ];
  return [...new Set(ids.filter((id): id is string => id !== undefined && uuid.safeParse(id).success))];
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * `authorization` is the exact `Authorization` value set in RevenueCat's dashboard; it is
 * compared as SHA-256 digests with `timingSafeEqual`, so neither its length nor its content
 * leaks through timing. Unset → `503`, and RevenueCat keeps the event for a retry.
 */
export function createRevenueCatWebhook(authorization: string | undefined, billing: () => BillingService): RequestHandler {
  const expected = authorization ? digest(authorization) : null;

  return async (req, res, next) => {
    if (!expected) {
      sendError(res, req, 503, "PURCHASES_UNAVAILABLE", "The RevenueCat webhook is not set up");
      return;
    }
    const presented = req.headers.authorization;
    if (!presented || !timingSafeEqual(digest(presented), expected)) {
      sendError(res, req, 401, "UNAUTHORIZED", "Invalid webhook authorization");
      return;
    }
    const body = webhookSchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, req, 400, "VALIDATION_ERROR", "Not a RevenueCat event");
      return;
    }

    const { event } = body.data;
    const service = billing();
    if (!service.purchasesEnabled) {
      sendError(res, req, 503, "PURCHASES_UNAVAILABLE", "Purchases are not set up");
      return;
    }
    // A dashboard test, or a store environment this server does not grant from: received, nothing to do.
    const ignored = event.type === "TEST" || (event.environment !== undefined && !service.acceptsEnvironment(event.environment));
    const userIds = ignored ? [] : eventUserIds(event);

    try {
      let synced = 0;
      for (const userId of userIds) {
        if (await service.syncFromRevenueCat(userId)) synced += 1;
      }
      rootLogger.info({ eventId: event.id, type: event.type, environment: event.environment, synced }, "revenuecat webhook");
      sendSuccess(res, req, 200, { event_id: event.id, synced });
    } catch (error) {
      next(error);
    }
  };
}
