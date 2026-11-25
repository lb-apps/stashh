import { z } from "zod";

/**
 * RevenueCat REST API v2, the parts billing needs: a customer's subscriptions (to sync the plan)
 * and deleting a customer (when a person is erased). The customer id is the Supabase user id.
 * https://www.revenuecat.com/docs/api-v2
 */

const API_BASE = "https://api.revenuecat.com/v2";
const TIMEOUT_MS = 10_000;
/** A customer has a handful of subscriptions; a longer chain of pages means something is wrong. */
const MAX_PAGES = 10;

export type RevenueCatEnvironment = "sandbox" | "production";

const subscriptionSchema = z.object({
  id: z.string(),
  /** RevenueCat's own answer to "should this subscription give access now" (grace periods included). */
  gives_access: z.boolean(),
  environment: z.string(),
  store: z.string(),
  current_period_ends_at: z.number().nullable(),
  /** End of the latest paid period; null while paused indefinitely. */
  ends_at: z.number().nullable(),
  entitlements: z.object({ items: z.array(z.object({ lookup_key: z.string() })) }),
});
export type RevenueCatSubscription = z.infer<typeof subscriptionSchema>;

const subscriptionPageSchema = z.object({
  items: z.array(subscriptionSchema),
  next_page: z.string().nullish(),
});

/** RevenueCat answered with an error, or did not answer in time. Carries no response body. */
export class RevenueCatError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "RevenueCatError";
  }
}

export interface RevenueCatCustomers {
  /** Every subscription of the customer, in both environments; none when the customer does not exist. */
  subscriptions(customerId: string): Promise<RevenueCatSubscription[]>;
  /** Deletes the customer; false when there was none. */
  deleteCustomer(customerId: string): Promise<boolean>;
}

export class RevenueCatClient implements RevenueCatCustomers {
  constructor(
    private readonly projectId: string,
    private readonly secretKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async subscriptions(customerId: string): Promise<RevenueCatSubscription[]> {
    const items: RevenueCatSubscription[] = [];
    let path: string | null = `${this.customerPath(customerId)}/subscriptions?limit=100`;
    for (let page = 0; path; page += 1) {
      if (page === MAX_PAGES) throw new RevenueCatError(`RevenueCat subscriptions: more than ${MAX_PAGES} pages`, null);
      const response = await this.request("GET", path);
      if (response.status === 404) return [];
      const body = subscriptionPageSchema.parse(await response.json());
      items.push(...body.items);
      // `next_page` is a path from the API root ("/v2/projects/…").
      path = body.next_page ? body.next_page.replace(/^\/v2(?=\/)/, "") : null;
    }
    return items;
  }

  async deleteCustomer(customerId: string): Promise<boolean> {
    const response = await this.request("DELETE", this.customerPath(customerId));
    return response.status !== 404;
  }

  private customerPath(customerId: string): string {
    return `/projects/${encodeURIComponent(this.projectId)}/customers/${encodeURIComponent(customerId)}`;
  }

  /** A response that is ok or `404`; anything else throws. */
  private async request(method: "GET" | "DELETE", path: string): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API_BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.secretKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new RevenueCatError(`RevenueCat ${method} did not answer: ${error instanceof Error ? error.name : "error"}`, null);
    }
    if (!response.ok && response.status !== 404) {
      throw new RevenueCatError(`RevenueCat ${method} answered ${response.status}`, response.status);
    }
    return response;
  }
}
