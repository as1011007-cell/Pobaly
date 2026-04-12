import { db } from "../db";
import { sql } from "drizzle-orm";
import http2 from "http2";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
const APNS_HOST = "api.push.apple.com";
const APNS_BUNDLE_ID = "app.probaly.logic";

// ── APNs JWT (cached, refreshed every 55 minutes) ───────────────────────────

let apnsJwt: string | null = null;
let apnsJwtExpiry = 0;

function getApnsJwt(): string | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyPath = process.env.APNS_KEY_PATH;

  if (!keyId || !teamId || !keyPath) return null;

  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt && now < apnsJwtExpiry) return apnsJwt;

  try {
    const absPath = path.resolve(keyPath);
    const privateKey = fs.readFileSync(absPath, "utf8");

    const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString("base64url");
    const unsigned = `${header}.${payload}`;

    const sign = crypto.createSign("SHA256");
    sign.update(unsigned);
    const sig = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");

    apnsJwt = `${unsigned}.${sig}`;
    apnsJwtExpiry = now + 55 * 60;
    return apnsJwt;
  } catch (err) {
    console.error("[APNs] Failed to create JWT:", err);
    return null;
  }
}

// ── APNs HTTP/2 direct send ──────────────────────────────────────────────────

let apnsClient: http2.ClientHttp2Session | null = null;
let apnsClientConnecting = false;

function getApnsClient(): Promise<http2.ClientHttp2Session> {
  return new Promise((resolve, reject) => {
    if (apnsClient && !apnsClient.destroyed) {
      resolve(apnsClient);
      return;
    }
    const client = http2.connect(`https://${APNS_HOST}`);
    client.on("error", (err) => {
      apnsClient = null;
      reject(err);
    });
    client.on("close", () => { apnsClient = null; });
    apnsClient = client;
    resolve(client);
  });
}

async function sendApnsNotification(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const jwt = getApnsJwt();
  if (!jwt) {
    throw new Error("[APNs] No JWT — check APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH");
  }

  const client = await getApnsClient();

  return new Promise((resolve, reject) => {
    const reqHeaders: http2.OutgoingHttpHeaders = {
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "authorization": `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    };

    const req = client.request(reqHeaders);
    let statusCode = 0;
    let responseBody = "";

    req.on("response", (headers) => {
      statusCode = headers[":status"] as number;
    });
    req.on("data", (chunk) => { responseBody += chunk; });
    req.on("end", () => {
      if (statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`APNs ${statusCode}: ${responseBody}`));
      }
    });
    req.on("error", reject);

    const apsPayload = {
      aps: {
        alert: { title, body },
        sound: "default",
        badge: 1,
      },
      ...(data || {}),
    };

    req.write(JSON.stringify(apsPayload));
    req.end();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNativeIosToken(token: string): boolean {
  return /^[0-9a-f]{64}$/i.test(token);
}

// ── Database helpers ─────────────────────────────────────────────────────────

export async function initPushTokensTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform VARCHAR(10) DEFAULT 'unknown',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens (user_id)
  `);
}

export async function registerPushToken(
  userId: string,
  token: string,
  platform: string
): Promise<void> {
  await db.execute(sql`
    INSERT INTO push_tokens (user_id, token, platform, updated_at)
    VALUES (${userId}, ${token}, ${platform}, NOW())
    ON CONFLICT (token)
    DO UPDATE SET user_id = ${userId}, platform = ${platform}, updated_at = NOW()
  `);
}

export async function removePushToken(token: string): Promise<void> {
  await db.execute(sql`DELETE FROM push_tokens WHERE token = ${token}`);
}

export async function removeUserPushTokens(userId: string): Promise<void> {
  await db.execute(sql`DELETE FROM push_tokens WHERE user_id = ${userId}`);
}

export async function clearAllPushTokens(): Promise<number> {
  const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM push_tokens`);
  const rows = (countResult as any)?.rows ?? Array.from(countResult ?? []);
  const count = parseInt(rows[0]?.count ?? "0", 10);
  await db.execute(sql`DELETE FROM push_tokens`);
  return count;
}

interface TokenRow { token: string; platform: string; }

async function getAllTokensNoPrefs(): Promise<TokenRow[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT pt.token, pt.platform
    FROM push_tokens pt
    LEFT JOIN user_preferences up ON pt.user_id = up.user_id
    WHERE (up.notifications_enabled IS NULL OR up.notifications_enabled = true)
      AND (up.prediction_alerts IS NULL OR up.prediction_alerts = true)
  `);
  const rows = (result as any)?.rows ?? Array.from(result ?? []);
  return rows
    .filter((r: any) => r.token)
    .map((r: any) => ({ token: r.token as string, platform: (r.platform ?? "unknown") as string }));
}

// ── Send to all devices ──────────────────────────────────────────────────────

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  channelId?: string;
}

async function sendExpoMessages(messages: PushMessage[]): Promise<{ success: number; failed: number }> {
  if (messages.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error("[Push] Expo API error:", response.status, await response.text());
        failed += chunk.length;
        continue;
      }

      const result = await response.json();
      const tickets: any[] = result.data || [];

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === "ok") {
          success++;
        } else {
          failed++;
          if (ticket.details?.error === "DeviceNotRegistered") {
            await removePushToken(chunk[i].to);
          }
        }
      }
    } catch (err) {
      console.error("[Push] Expo send error:", err);
      failed += chunk.length;
    }
  }

  return { success, failed };
}

async function sendNotificationsToAll(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const tokens = await getAllTokensNoPrefs();
  if (tokens.length === 0) {
    console.log("[Push] No push tokens registered, skipping notification");
    return;
  }

  const nativeIos: TokenRow[] = [];
  const expoTokens: TokenRow[] = [];

  for (const t of tokens) {
    if (isNativeIosToken(t.token)) {
      nativeIos.push(t);
    } else if (t.token.startsWith("ExponentPushToken[")) {
      expoTokens.push(t);
    }
  }

  let iosSuccess = 0;
  let iosFailed = 0;

  for (const t of nativeIos) {
    try {
      await sendApnsNotification(t.token, title, body, data);
      iosSuccess++;
    } catch (err: any) {
      iosFailed++;
      const msg = err?.message ?? "";
      if (msg.includes("BadDeviceToken") || msg.includes("Unregistered")) {
        await removePushToken(t.token);
      } else {
        console.warn(`[APNs] Send failed for token: ${msg}`);
      }
    }
  }

  const expoMessages: PushMessage[] = expoTokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: "default",
    badge: 1,
    ...(t.platform === "android" ? { channelId: "predictions" } : {}),
  }));

  const { success: expoSuccess, failed: expoFailed } = await sendExpoMessages(expoMessages);

  const totalSuccess = iosSuccess + expoSuccess;
  const totalFailed = iosFailed + expoFailed;

  console.log(
    `[Push] Sent to ${tokens.length} devices: ${totalSuccess} succeeded, ${totalFailed} failed` +
    (nativeIos.length > 0 ? ` (${iosSuccess}/${nativeIos.length} direct APNs)` : "") +
    (expoTokens.length > 0 ? ` (${expoSuccess}/${expoTokens.length} via Expo)` : "")
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function notifyDailyFreePredictionReady(): Promise<void> {
  try {
    await sendNotificationsToAll(
      "Your Daily Free Tip is Ready!",
      "A new AI-powered prediction is waiting for you. Open the app to check it out!",
      { type: "daily_prediction", screen: "Home" }
    );
  } catch (error) {
    console.error("[Push] Error sending daily prediction notifications:", error);
  }
}
