import { timingSafeEqual } from "node:crypto";
import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Logger } from "../lib/logger.ts";
import { RELAY_PROBE_QUERY } from "./core/commands.ts";
import { openEnvelope, type RelayEnvelope } from "./core/envelope.ts";
import { createWebhookCounters, type WebhookCounters } from "./counters.ts";
import { isValidSignature } from "./signature.ts";

/**
 * Receives a verified delivery. Implementations must be durable: the webhook is
 * acknowledged only after `accept` resolves, so a throw makes Meta redeliver.
 */
export interface WebhookSink {
  accept(delivery: VerifiedDelivery): Promise<void>;
}

export interface VerifiedDelivery {
  rawBody: Buffer;
  body: WebhookEnvelope;
  /** What the hooks relay said about this delivery; null when it came straight from Meta. */
  relay: RelayEnvelope | null;
  receivedAt: Date;
}

/** Outer envelope only; per-event parsing belongs to the conversation layer. */
const webhookEnvelopeSchema = z.object({
  object: z.literal("instagram"),
  entry: z.array(z.looseObject({ id: z.string(), time: z.number() })),
});
export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;

export interface WebhookRouterDeps {
  appSecret: string;
  verifyToken: string;
  sink: WebhookSink;
  log: Logger;
  counters?: WebhookCounters;
  /** Opens the hooks relay's envelope; unset → this instance takes no relayed deliveries. */
  relaySecret?: string | undefined;
}

export function createWebhookRouter({
  appSecret,
  verifyToken,
  sink,
  log,
  counters = createWebhookCounters(),
  relaySecret,
}: WebhookRouterDeps): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    // The relay asks before routing anyone here: 204 says this instance opens its envelope.
    if (relaySecret && new URL(req.originalUrl, "http://localhost").search === `?${RELAY_PROBE_QUERY}`) {
      res.sendStatus(204);
      return;
    }

    // Subscription handshake: echo hub.challenge only for our verify token.
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && typeof token === "string" && safeEqual(token, verifyToken) && typeof challenge === "string") {
      log.info("webhook subscription verified");
      res.status(200).type("text/plain").send(challenge);
      return;
    }
    log.warn({ mode }, "webhook verification rejected");
    res.sendStatus(403);
  });

  // Deliveries: raw bytes are required for the HMAC, so JSON parsing happens here.
  router.post("/", express.raw({ type: "application/json", limit: "1mb" }), async (req: Request, res: Response) => {
    const rawBody: unknown = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      res.sendStatus(415);
      return;
    }
    if (!isValidSignature(rawBody, req.get("x-hub-signature-256"), appSecret)) {
      log.warn("webhook signature rejected");
      counters.rejected_signature += 1;
      res.sendStatus(401);
      return;
    }

    // Trusted like Meta's signature. Absent: a direct delivery from Meta, still valid. Present but
    // not holding: refused, never read as direct — that would let a forged request skip the routing.
    const opened = await openEnvelope({ get: (name) => req.get(name) ?? null }, rawBody.toString("utf8"), relaySecret);
    if (!opened.ok) {
      log.warn("webhook refused: relay envelope does not hold");
      res.sendStatus(403);
      return;
    }

    const parsed = webhookEnvelopeSchema.safeParse(safeJsonParse(rawBody));
    if (!parsed.success) {
      // Signed by Meta but not a shape we handle (e.g. another product's object).
      // Acknowledge so it is not redelivered for 36 hours.
      log.warn({ issues: parsed.error.issues }, "webhook body ignored: unexpected envelope");
      counters.ignored_envelope += 1;
      res.sendStatus(200);
      return;
    }

    try {
      await sink.accept({ rawBody, body: parsed.data, relay: opened.envelope, receivedAt: new Date() });
      counters.deliveries += 1;
      res.sendStatus(200);
    } catch (error) {
      log.error({ err: error }, "webhook delivery not persisted; Meta will retry");
      res.sendStatus(500);
    }
  });

  return router;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function safeJsonParse(buffer: Buffer): unknown {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return undefined;
  }
}
