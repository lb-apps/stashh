import "server-only";

import { createHash } from "node:crypto";
import type { MetaEventName } from "./events";

/**
 * Meta's Conversions API: the server's copy of an event the pixel also sends
 * (meta-pixel.ts), under the same name and event id so Meta counts the pair
 * once. It runs on the Next server because that is the only place that sees
 * the visitor's own IP and user agent; the backend sends nothing.
 *
 * What Meta gets to match the visitor: IP, user agent, the pixel's own
 * first-party cookies when present, and a hash of the Supabase user id.
 * Never the Instagram id, a username or the link's code.
 */

const GRAPH_API_VERSION = "v27.0";

export interface MetaServerEvent {
  name: MetaEventName;
  /** Shared with the pixel's copy of the event. */
  eventId: string;
  userId: string;
  /** The page the action happened on, without anything personal in it. */
  sourceUrl: string;
  clientIp: string | null;
  userAgent: string | null;
  /** The pixel's `_fbp` and `_fbc` cookies. */
  fbp: string | null;
  fbc: string | null;
}

export async function sendMetaEvent(event: MetaServerEvent): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  // Meta rejects a website event without a user agent.
  if (!pixelId || !accessToken || !event.userAgent) return;

  const body = {
    data: [
      {
        event_name: event.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.sourceUrl,
        user_data: {
          client_user_agent: event.userAgent,
          ...(event.clientIp ? { client_ip_address: event.clientIp } : {}),
          ...(event.fbp ? { fbp: event.fbp } : {}),
          ...(event.fbc ? { fbc: event.fbc } : {}),
          external_id: [createHash("sha256").update(event.userId).digest("hex")],
        },
      },
    ],
    // Set only in local and preview: the event then shows under Test Events and builds no audience.
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
    // In the body, not the query string, so the token is never part of a logged URL.
    access_token: accessToken,
  };

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null);

  // An audience signal, never worth failing a sign-in over. The status alone: no body, IP or token in logs.
  if (!response?.ok) console.warn(`Meta Conversions API: ${event.name} not accepted (${response?.status ?? "no response"})`);
}
