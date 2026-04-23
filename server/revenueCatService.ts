let cachedToken: { value: string; expiresAt: number } | null = null;

async function getRCAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

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
    const token =
      conn?.settings?.access_token ||
      conn?.settings?.oauth?.credentials?.access_token;

    if (!token) return null;

    const expiresAt = conn?.settings?.expires_at
      ? new Date(conn.settings.expires_at).getTime()
      : Date.now() + 10 * 60 * 1000;

    cachedToken = { value: token, expiresAt };
    return token;
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
  const token = await getRCAccessToken();
  if (!token) {
    console.log("[RC] No access token — skipping server-side RC check");
    return null;
  }

  try {
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.log(`[RC] Subscriber lookup returned HTTP ${res.status} for user ${userId}`);
      return null;
    }

    const body = await res.json();
    const entitlement = body?.subscriber?.entitlements?.premium;

    if (!entitlement) {
      return { isPremium: false };
    }

    const expiresDate = entitlement.expires_date
      ? new Date(entitlement.expires_date)
      : null;
    const isActive = !expiresDate || expiresDate > new Date();

    if (isActive) {
      return {
        isPremium: true,
        expiryDate: expiresDate ?? undefined,
        productIdentifier: entitlement.product_identifier,
      };
    }

    return { isPremium: false };
  } catch (error) {
    console.error("[RC] checkRCSubscription error:", error);
    return null;
  }
}
