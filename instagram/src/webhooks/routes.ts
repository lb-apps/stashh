import { timingSafeEqual } from "node:crypto";
import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Logger } from "../lib/logger.ts";
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
}

export function createWebhookRouter({ appSecret, verifyToken, sink, log }: WebhookRouterDeps): Router {
  const router = Router();

  // Subscription handshake: echo hub.challenge only for our verify token.
  router.get("/", (req: Request, res: Response) => {
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
      res.sendStatus(401);
      return;
    }

    const parsed = webhookEnvelopeSchema.safeParse(safeJsonParse(rawBody));
    if (!parsed.success) {
      // Signed by Meta but not a shape we handle (e.g. another product's object).
      // Acknowledge so it is not redelivered for 36 hours.
      log.warn({ issues: parsed.error.issues }, "webhook body ignored: unexpected envelope");
      res.sendStatus(200);
      return;
    }

    try {
      await sink.accept({ rawBody, body: parsed.data, receivedAt: new Date() });
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
