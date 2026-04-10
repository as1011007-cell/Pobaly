import { db } from "../db";
import { sql } from "drizzle-orm";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

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
  const result = await db.execute(sql`DELETE FROM push_tokens RETURNING id`);
  const rows = (result as any)?.rows ?? Array.from(result ?? []);
  return rows.length;
}

async function getAllPushTokens(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT pt.token
    FROM push_tokens pt
    INNER JOIN user_preferences up ON pt.user_id = up.user_id
    WHERE up.notifications_enabled = true
      AND up.prediction_alerts = true
  `);
  const rows = (result as any)?.rows ?? Array.from(result ?? []);
  const tokens: string[] = rows
    .map((r: any) => r.token)
    .filter((t: string) => t && t.startsWith("ExponentPushToken["));
  return tokens;
}

async function getAllPushTokensNoPrefs(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT pt.token
    FROM push_tokens pt
    LEFT JOIN user_preferences up ON pt.user_id = up.user_id
    WHERE (up.notifications_enabled IS NULL OR up.notifications_enabled = true)
      AND (up.prediction_alerts IS NULL OR up.prediction_alerts = true)
  `);
  const rows = (result as any)?.rows ?? Array.from(result ?? []);
  return rows
    .map((r: any) => r.token)
    .filter((t: string) => t && t.startsWith("ExponentPushToken["));
}

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  channelId?: string;
}

async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error("Expo push API error:", response.status, await response.text());
        continue;
      }

      const result = await response.json();
      const tickets: any[] = result.data || [];
      let successCount = 0;
      let removedCount = 0;

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === "ok") {
          successCount++;
        } else if (ticket.status === "error") {
          if (ticket.details?.error === "DeviceNotRegistered") {
            // Tickets are returned in the same order as messages — match by index
            await removePushToken(chunk[i].to);
            removedCount++;
          }
        }
      }

      if (removedCount > 0) {
        console.log(`Removed ${removedCount} stale push tokens (DeviceNotRegistered)`);
      }

      const errorCount = tickets.length - successCount - removedCount;
      if (errorCount > 0) {
        console.warn(`Push notification errors: ${errorCount}/${tickets.length}`);
      }

      console.log(`Sent ${chunk.length} push notifications (${successCount} succeeded)`);
    } catch (error) {
      console.error("Failed to send push notifications:", error);
    }
  }
}

export async function notifyDailyFreePredictionReady(): Promise<void> {
  try {
    const tokens = await getAllPushTokensNoPrefs();
    if (tokens.length === 0) {
      console.log("No push tokens registered, skipping notification");
      return;
    }

    const messages: PushMessage[] = tokens.map((token) => ({
      to: token,
      title: "Your Daily Free Tip is Ready!",
      body: "A new AI-powered prediction is waiting for you. Open the app to check it out!",
      data: { type: "daily_prediction", screen: "Home" },
      sound: "default",
      badge: 1,
      channelId: "predictions",
    }));

    await sendPushNotifications(messages);
    console.log(`Daily prediction notification sent to ${tokens.length} devices`);
  } catch (error) {
    console.error("Error sending daily prediction notifications:", error);
  }
}
