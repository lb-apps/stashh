import { truncateGraphemes, truncateUtf8 } from "./text.ts";

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
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/me/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${await this.tokens.accessToken()}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new GraphApiError(0, null, `Graph API unreachable: ${(error as Error).message}`);
    }
    if (response.ok) return;

    const payload = (await response.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
    throw new GraphApiError(response.status, payload?.error?.code ?? null, payload?.error?.message ?? `HTTP ${response.status}`);
  }
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
