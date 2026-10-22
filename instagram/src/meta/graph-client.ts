import { truncateGraphemes, truncateUtf16, truncateUtf8 } from "./text.ts";

/** Instagram Send API limits (Instagram API with Instagram Login). */
export const LIMITS = {
  textBytes: 1000,
  templateElements: 10,
  titleChars: 80,
  subtitleChars: 80,
  buttonsPerElement: 3,
  buttonTitleChars: 20,
} as const;

export interface UrlButton {
  title: string;
  url: string;
}

export interface CarouselCard {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  /** Opened when the card itself is tapped. */
  url?: string;
  buttons: UrlButton[];
}

/** One outbound message, in channel-neutral terms. */
export type OutboundMessage = { kind: "text"; text: string } | { kind: "carousel"; cards: CarouselCard[] };

export class GraphApiError extends Error {
  readonly status: number;
  readonly code: number | null;

  constructor(status: number, code: number | null, message: string) {
    super(message);
    this.name = "GraphApiError";
    this.status = status;
    this.code = code;
  }

  /** Throttling (codes 4, 17, 613), transient (1, 2) and 5xx are retryable. */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500 || [1, 2, 4, 17, 613].includes(this.code ?? -1);
  }
}

export interface Messenger {
  send(recipientId: string, message: OutboundMessage): Promise<void>;
  typing(recipientId: string): Promise<void>;
}

export interface AccessTokenSource {
  accessToken(): Promise<string>;
}

/** Sends messages from our professional account through graph.instagram.com. */
export class InstagramMessenger implements Messenger {
  private readonly baseUrl: string;
  private readonly tokens: AccessTokenSource;

  constructor(options: { apiVersion: string; tokens: AccessTokenSource; baseUrl?: string }) {
    this.baseUrl = `${options.baseUrl ?? "https://graph.instagram.com"}/${options.apiVersion}`;
    this.tokens = options.tokens;
  }

  async send(recipientId: string, message: OutboundMessage): Promise<void> {
    await this.post({ recipient: { id: recipientId }, message: toGraphMessage(message) });
  }

  async typing(recipientId: string): Promise<void> {
    await this.post({ recipient: { id: recipientId }, sender_action: "typing_on" });
  }

  private async post(body: unknown): Promise<void> {
    const response = await graphFetch(`${this.baseUrl}/me/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${await this.tokens.accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw await graphError(response);
  }
}

/** The public profile of someone who messaged us, in the shape the Stashh backend stores. */
export interface InstagramProfile {
  username: string;
  name: string | null;
}

export interface ProfileReader {
  /** Null when Meta answers without a usable username. Throws `GraphApiError` on failure. */
  profile(igsid: string): Promise<InstagramProfile | null>;
}

/** Reads profiles of people who messaged us (User Profile API, Instagram Login). */
export class InstagramProfiles implements ProfileReader {
  private readonly baseUrl: string;
  private readonly tokens: AccessTokenSource;

  constructor(options: { apiVersion: string; tokens: AccessTokenSource; baseUrl?: string }) {
    this.baseUrl = `${options.baseUrl ?? "https://graph.instagram.com"}/${options.apiVersion}`;
    this.tokens = options.tokens;
  }

  async profile(igsid: string): Promise<InstagramProfile | null> {
    const response = await graphFetch(`${this.baseUrl}/${encodeURIComponent(igsid)}?fields=username,name`, {
      headers: { authorization: `Bearer ${await this.tokens.accessToken()}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw await graphError(response);
    return toProfile(await response.json().catch(() => null));
  }
}

/**
 * Normalizes a User Profile API body to the backend's contract (username per Instagram's
 * rules, name trimmed and capped), so a profile can never make the backend reject a request.
 */
export function toProfile(body: unknown): InstagramProfile | null {
  const { username, name } = (body ?? {}) as { username?: unknown; name?: unknown };
  if (typeof username !== "string" || !/^[A-Za-z0-9._]{1,30}$/.test(username)) return null;
  const trimmed = typeof name === "string" ? truncateUtf16(name.trim(), PROFILE_NAME_UNITS) : "";
  return { username, name: trimmed || null };
}

/** The backend caps stored profile names at this length. */
const PROFILE_NAME_UNITS = 200;

async function graphFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new GraphApiError(0, null, `Graph API unreachable: ${(error as Error).message}`);
  }
}

async function graphError(response: Response): Promise<GraphApiError> {
  const payload = (await response.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
  return new GraphApiError(response.status, payload?.error?.code ?? null, payload?.error?.message ?? `HTTP ${response.status}`);
}

/** Maps an outbound message to the Send API body, enforcing every documented limit. */
export function toGraphMessage(message: OutboundMessage): Record<string, unknown> {
  if (message.kind === "text") return { text: truncateUtf8(message.text, LIMITS.textBytes) };

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: message.cards.slice(0, LIMITS.templateElements).map((card) => ({
          title: truncateGraphemes(card.title, LIMITS.titleChars),
          ...(card.subtitle ? { subtitle: truncateGraphemes(card.subtitle, LIMITS.subtitleChars) } : {}),
          ...(card.imageUrl ? { image_url: card.imageUrl } : {}),
          ...(card.url ? { default_action: { type: "web_url", url: card.url } } : {}),
          buttons: card.buttons.slice(0, LIMITS.buttonsPerElement).map((button) => ({
            type: "web_url",
            title: truncateGraphemes(button.title, LIMITS.buttonTitleChars),
            url: button.url,
          })),
        })),
      },
    },
  };
}
