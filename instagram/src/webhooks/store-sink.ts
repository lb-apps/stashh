import { extractInboundMessages } from "../conversation/events.ts";
import type { MessageStore } from "../conversation/store.ts";
import type { Logger } from "../lib/logger.ts";
import type { Environment } from "./core/environments.ts";
import type { WebhookCounters } from "./counters.ts";
import { relayCommandOf, routedHere } from "./relay.ts";
import type { VerifiedDelivery, WebhookSink } from "./routes.ts";

/**
 * Production sink: stores each inbound message in the work queue. The webhook is
 * acknowledged only once this resolves, so nothing Meta delivered is lost; the
 * worker does the slow part later — including the answer to a relay `/env` command.
 */
export class StoreSink implements WebhookSink {
  private readonly store: MessageStore;
  private readonly accountId: string;
  private readonly environment: Environment;
  private readonly log: Logger;
  private readonly counters: WebhookCounters | undefined;

  constructor(options: { store: MessageStore; accountId: string; environment: Environment; log: Logger; counters?: WebhookCounters }) {
    this.store = options.store;
    this.accountId = options.accountId;
    this.environment = options.environment;
    this.log = options.log;
    this.counters = options.counters;
  }

  async accept({ body, relay }: VerifiedDelivery): Promise<void> {
    const all = extractInboundMessages(body);
    // The dashboard's Test tool and any other account's traffic are not ours to answer.
    const ours = all.filter((m) => m.accountId === this.accountId);
    if (ours.length < all.length) {
      this.log.info({ dropped: all.length - ours.length }, "webhook messages for another account ignored");
    }
    const relayRouted = routedHere(relay, this.environment);
    if (relay && !relayRouted) {
      this.log.warn({ routedTo: relay.env, environment: this.environment }, "relay delivery for another environment; its senders are not marked routed");
    }
    const stored = await this.store.insert(
      ours.map((message) => ({ ...message, relayRouted, relayCommand: relayCommandOf(message, relay) })),
    );
    if (this.counters) {
      this.counters.messages_queued += stored;
      this.counters.messages_duplicate += ours.length - stored;
      this.counters.other_account += all.length - ours.length;
    }
    this.log.info({ received: ours.length, stored }, "webhook messages queued");
  }
}

/** Hands one delivery to several sinks in order (development: queue it and capture it). */
export class FanOutSink implements WebhookSink {
  private readonly sinks: WebhookSink[];

  constructor(sinks: WebhookSink[]) {
    this.sinks = sinks;
  }

  async accept(delivery: VerifiedDelivery): Promise<void> {
    for (const sink of this.sinks) await sink.accept(delivery);
  }
}
