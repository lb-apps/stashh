/**
 * What the webhook has seen since this process started, for the ops dashboard. In memory
 * only: it describes this instance, and a restart starts it over.
 */
export interface WebhookCounters {
  since: string;
  /** Signed deliveries handed to the sink. */
  deliveries: number;
  rejected_signature: number;
  /** Signed, but not an Instagram messaging envelope. */
  ignored_envelope: number;
  messages_queued: number;
  /** Meta redelivered a message we already had. */
  messages_duplicate: number;
  /** Addressed to another account (the dashboard's Test tool, for one). */
  other_account: number;
}

export function createWebhookCounters(now: Date = new Date()): WebhookCounters {
  return {
    since: now.toISOString(),
    deliveries: 0,
    rejected_signature: 0,
    ignored_envelope: 0,
    messages_queued: 0,
    messages_duplicate: 0,
    other_account: 0,
  };
}
