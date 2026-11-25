import type { Package, Purchases } from "@revenuecat/purchases-js";
import { publicEnv } from "@/lib/env";
import type { PremiumPeriod } from "@/lib/stashh/types";

/**
 * RevenueCat's web SDK, which sells Premium through Paddle's checkout. It is loaded only when
 * the paywall needs it, and only where `NEXT_PUBLIC_REVENUECAT_API_KEY` is set. The customer is
 * always the signed-in Supabase user, never an anonymous id, so a purchase lands on the same
 * person in RevenueCat, Supabase and Mixpanel.
 */

const sdk = () => import("@revenuecat/purchases-js");

/** One of Premium's two prices, as the `default` offering sells it to this person. */
export interface PremiumOffer {
  period: PremiumPeriod;
  rcPackage: Package;
  /** In micro-units of `currency` (₺129.99 → 129_990_000), for the reader's own number format. */
  amountMicros: number;
  currency: string;
}

let configured: { userId: string; purchases: Promise<Purchases> } | null = null;

/** The shared SDK instance for this person; concurrent callers share one configuration. */
function purchasesFor(userId: string): Promise<Purchases> {
  if (configured?.userId === userId) return configured.purchases;
  const apiKey = publicEnv.revenueCatApiKey;
  if (!apiKey) return Promise.reject(new Error("NEXT_PUBLIC_REVENUECAT_API_KEY is not set"));

  const purchases = sdk().then(async ({ Purchases }) => {
    if (!Purchases.isConfigured()) return Purchases.configure({ apiKey, appUserId: userId });
    const shared = Purchases.getSharedInstance();
    if (shared.getAppUserId() !== userId) await shared.changeUser(userId);
    return shared;
  });
  configured = { userId, purchases };
  // A failed load is not cached: the next call tries again.
  purchases.catch(() => {
    if (configured?.purchases === purchases) configured = null;
  });
  return purchases;
}

/** Premium's monthly and yearly prices from the `default` offering; null when it is not set up. */
export async function loadPremiumOffers(userId: string): Promise<Record<PremiumPeriod, PremiumOffer> | null> {
  const offering = (await (await purchasesFor(userId)).getOfferings()).current;
  if (!offering?.monthly || !offering.annual) return null;
  const offer = (period: PremiumPeriod, rcPackage: Package): PremiumOffer => ({
    period,
    rcPackage,
    amountMicros: rcPackage.product.price.amountMicros,
    currency: rcPackage.product.price.currency,
  });
  return { monthly: offer("monthly", offering.monthly), yearly: offer("yearly", offering.annual) };
}

/** Opens Paddle's checkout over the page; "cancelled" when the person closes it. */
export async function purchasePremium(userId: string, offer: PremiumOffer, language: string): Promise<"purchased" | "cancelled"> {
  const purchases = await purchasesFor(userId);
  const { ErrorCode, PurchasesError } = await sdk();
  try {
    await purchases.purchase({ rcPackage: offer.rcPackage, selectedLocale: language });
    return "purchased";
  } catch (error) {
    if (error instanceof PurchasesError && error.errorCode === ErrorCode.UserCancelledError) return "cancelled";
    throw error;
  }
}

/** Where the person changes or cancels their subscription (Paddle's portal); null when there is none. */
export async function subscriptionManagementUrl(userId: string): Promise<string | null> {
  return (await (await purchasesFor(userId)).getCustomerInfo()).managementURL;
}
