import { createClient } from "@replit/revenuecat-sdk/client";
import { listCustomerActiveEntitlements } from "@replit/revenuecat-sdk";

const REVENUECAT_PROJECT_ID = process.env.REVENUECAT_PROJECT_ID || "projdf936295";
const PREMIUM_ENTITLEMENT_LOOKUP_KEY = "premium";

async function getRCClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) {
    return null;
  }

  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const conn = data.items?.[0];
    const accessToken =
      conn?.settings?.access_token ||
      conn?.settings?.oauth?.credentials?.access_token;

    if (!accessToken) return null;

    return createClient({
      baseUrl: "https://api.revenuecat.com/v2",
      headers: { Authorization: "Bearer " + accessToken },
    });
  } catch {
    return null;
  }
}

export interface RCSubscriptionStatus {
  isPremium: boolean;
  expiryDate?: Date;
  productIdentifier?: string;
}

export async function checkRCSubscription(
  userId: string
): Promise<RCSubscriptionStatus | null> {
  const client = await getRCClient();
  if (!client) {
    console.log("[RC] No client available — skipping server-side RC check");
    return null;
  }

  try {
    const { data, error } = await listCustomerActiveEntitlements({
      client,
      path: {
        project_id: REVENUECAT_PROJECT_ID,
        customer_id: userId,
      },
    });

    if (error) {
      console.log(`[RC] Active entitlements lookup failed for user ${userId}:`, error);
      return null;
    }

    const entitlements = data?.items ?? [];
    const premiumEntitlement = entitlements.find(
      (e: any) => e.lookup_key === PREMIUM_ENTITLEMENT_LOOKUP_KEY
    );

    if (!premiumEntitlement) {
      return { isPremium: false };
    }

    const expiresDate = (premiumEntitlement as any).expires_at
      ? new Date((premiumEntitlement as any).expires_at)
      : null;

    return {
      isPremium: true,
      expiryDate: expiresDate ?? undefined,
      productIdentifier: (premiumEntitlement as any).product_identifier,
    };
  } catch (error) {
    console.error("[RC] checkRCSubscription error:", error);
    return null;
  }
}
