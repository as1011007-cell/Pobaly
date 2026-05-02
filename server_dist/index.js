var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  affiliates: () => affiliates,
  contactSubmissions: () => contactSubmissions,
  conversations: () => conversations,
  insertAffiliateSchema: () => insertAffiliateSchema,
  insertContactSubmissionSchema: () => insertContactSubmissionSchema,
  insertConversationSchema: () => insertConversationSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertPayoutRequestSchema: () => insertPayoutRequestSchema,
  insertPredictionSchema: () => insertPredictionSchema,
  insertReferralSchema: () => insertReferralSchema,
  insertUserPreferencesSchema: () => insertUserPreferencesSchema,
  insertUserSchema: () => insertUserSchema,
  messages: () => messages,
  payoutRequests: () => payoutRequests,
  predictions: () => predictions,
  referrals: () => referrals,
  userPreferences: () => userPreferences,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users, insertUserSchema, predictions, insertPredictionSchema, conversations, messages, insertConversationSchema, insertMessageSchema, userPreferences, insertUserPreferencesSchema, affiliates, insertAffiliateSchema, referrals, insertReferralSchema, payoutRequests, insertPayoutRequestSchema, contactSubmissions, insertContactSubmissionSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      email: text("email").notNull().unique(),
      password: text("password").notNull(),
      name: text("name"),
      stripeCustomerId: text("stripe_customer_id"),
      stripeSubscriptionId: text("stripe_subscription_id"),
      isPremium: boolean("is_premium").default(false),
      premiumSince: timestamp("premium_since"),
      subscriptionExpiry: timestamp("subscription_expiry"),
      referredByCode: varchar("referred_by_code", { length: 20 }),
      createdAt: timestamp("created_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).pick({
      email: true,
      password: true,
      name: true
    });
    predictions = pgTable("predictions", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id"),
      // null for free predictions (public), set for premium (user-specific)
      matchTitle: text("match_title").notNull(),
      sport: text("sport").notNull(),
      // football, basketball, cricket, tennis
      matchTime: timestamp("match_time").notNull(),
      predictedOutcome: text("predicted_outcome").notNull(),
      probability: integer("probability").notNull(),
      // 0-100
      confidence: text("confidence").notNull(),
      // high, medium, low
      explanation: text("explanation").notNull(),
      factors: jsonb("factors"),
      // Array of analysis factors
      sportsbookOdds: jsonb("sportsbook_odds"),
      // Consensus odds from multiple sportsbooks
      riskIndex: integer("risk_index").notNull(),
      // 0-100
      isLive: boolean("is_live").default(false),
      isPremium: boolean("is_premium").default(true),
      result: text("result"),
      // correct, incorrect, null if pending
      createdAt: timestamp("created_at").defaultNow(),
      expiresAt: timestamp("expires_at")
    });
    insertPredictionSchema = createInsertSchema(predictions).omit({
      id: true,
      createdAt: true
    });
    conversations = pgTable("conversations", {
      id: serial("id").primaryKey(),
      title: text("title").notNull(),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    messages = pgTable("messages", {
      id: serial("id").primaryKey(),
      conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
      role: text("role").notNull(),
      content: text("content").notNull(),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    insertConversationSchema = createInsertSchema(conversations).omit({
      id: true,
      createdAt: true
    });
    insertMessageSchema = createInsertSchema(messages).omit({
      id: true,
      createdAt: true
    });
    userPreferences = pgTable("user_preferences", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id").notNull().unique(),
      notificationsEnabled: boolean("notifications_enabled").default(true),
      emailNotifications: boolean("email_notifications").default(true),
      predictionAlerts: boolean("prediction_alerts").default(true),
      language: varchar("language", { length: 10 }).default("en"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    affiliates = pgTable("affiliates", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id").notNull().unique().references(() => users.id),
      affiliateCode: varchar("affiliate_code", { length: 20 }).notNull().unique(),
      stripeConnectAccountId: text("stripe_connect_account_id"),
      stripeConnectOnboarded: boolean("stripe_connect_onboarded").default(false),
      commissionRate: integer("commission_rate").default(40),
      // 40% default
      totalEarnings: integer("total_earnings").default(0),
      // in cents
      pendingEarnings: integer("pending_earnings").default(0),
      // in cents
      paidEarnings: integer("paid_earnings").default(0),
      // in cents
      totalReferrals: integer("total_referrals").default(0),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow()
    });
    insertAffiliateSchema = createInsertSchema(affiliates).omit({
      id: true,
      createdAt: true,
      totalEarnings: true,
      pendingEarnings: true,
      paidEarnings: true,
      totalReferrals: true
    });
    referrals = pgTable("referrals", {
      id: serial("id").primaryKey(),
      affiliateId: integer("affiliate_id").notNull().references(() => affiliates.id),
      referredUserId: varchar("referred_user_id").notNull().references(() => users.id),
      subscriptionId: text("subscription_id"),
      subscriptionAmount: integer("subscription_amount"),
      // in cents
      commissionAmount: integer("commission_amount"),
      // in cents
      status: text("status").notNull().default("pending"),
      // pending, paid, cancelled
      paidAt: timestamp("paid_at"),
      createdAt: timestamp("created_at").defaultNow()
    });
    insertReferralSchema = createInsertSchema(referrals).omit({
      id: true,
      createdAt: true,
      paidAt: true
    });
    payoutRequests = pgTable("payout_requests", {
      id: serial("id").primaryKey(),
      affiliateId: integer("affiliate_id").notNull().references(() => affiliates.id),
      amount: integer("amount").notNull(),
      // in cents
      status: text("status").notNull().default("pending"),
      // pending, approved, rejected, paid
      stripeTransferId: text("stripe_transfer_id"),
      requestedAt: timestamp("requested_at").defaultNow(),
      reviewedAt: timestamp("reviewed_at"),
      reviewedBy: varchar("reviewed_by"),
      rejectionReason: text("rejection_reason"),
      paidAt: timestamp("paid_at")
    });
    insertPayoutRequestSchema = createInsertSchema(payoutRequests).omit({
      id: true,
      requestedAt: true,
      reviewedAt: true,
      paidAt: true
    });
    contactSubmissions = pgTable("contact_submissions", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      email: text("email").notNull(),
      subject: text("subject").notNull(),
      message: text("message").notNull(),
      status: text("status").notNull().default("new"),
      // new, read, resolved
      createdAt: timestamp("created_at").defaultNow()
    });
    insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
      id: true,
      status: true,
      createdAt: true
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db
});
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
var queryClient, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set");
    }
    queryClient = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      connect_timeout: 30,
      connection: {
        application_name: "probaly-app"
      }
    });
    db = drizzle(queryClient, { schema: schema_exports });
  }
});

// server/services/pushNotificationService.ts
var pushNotificationService_exports = {};
__export(pushNotificationService_exports, {
  clearAllPushTokens: () => clearAllPushTokens,
  initPushTokensTable: () => initPushTokensTable,
  notifyDailyFreePredictionReady: () => notifyDailyFreePredictionReady,
  registerPushToken: () => registerPushToken,
  removePushToken: () => removePushToken,
  removePushTokenForUser: () => removePushTokenForUser,
  removeUserPushTokens: () => removeUserPushTokens
});
import { sql as sql3 } from "drizzle-orm";
import http2 from "http2";
import crypto from "crypto";
import fs from "fs";
import path from "path";
function getApnsJwt() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyPath = process.env.APNS_KEY_PATH;
  if (!keyId || !teamId || !keyPath) return null;
  const now = Math.floor(Date.now() / 1e3);
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
function getApnsClient() {
  return new Promise((resolve3, reject) => {
    if (apnsClient && !apnsClient.destroyed) {
      resolve3(apnsClient);
      return;
    }
    const client = http2.connect(`https://${APNS_HOST}`);
    client.on("error", (err) => {
      apnsClient = null;
      reject(err);
    });
    client.on("close", () => {
      apnsClient = null;
    });
    apnsClient = client;
    resolve3(client);
  });
}
async function sendApnsNotification(deviceToken, title, body, data) {
  const jwt2 = getApnsJwt();
  if (!jwt2) {
    throw new Error("[APNs] No JWT \u2014 check APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH");
  }
  const client = await getApnsClient();
  return new Promise((resolve3, reject) => {
    const reqHeaders = {
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "authorization": `bearer ${jwt2}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json"
    };
    const req = client.request(reqHeaders);
    let statusCode = 0;
    let responseBody = "";
    req.on("response", (headers) => {
      statusCode = headers[":status"];
    });
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      if (statusCode === 200) {
        resolve3();
      } else {
        reject(new Error(`APNs ${statusCode}: ${responseBody}`));
      }
    });
    req.on("error", reject);
    const apsPayload = {
      aps: {
        alert: { title, body },
        sound: "default",
        badge: 1
      },
      ...data || {}
    };
    req.write(JSON.stringify(apsPayload));
    req.end();
  });
}
function isNativeIosToken(token) {
  return /^[0-9a-f]{64}$/i.test(token);
}
async function initPushTokensTable() {
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform VARCHAR(10) DEFAULT 'unknown',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql3`
    CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens (user_id)
  `);
}
async function registerPushToken(userId, token, platform) {
  await db.execute(sql3`
    INSERT INTO push_tokens (user_id, token, platform, updated_at)
    VALUES (${userId}, ${token}, ${platform}, NOW())
    ON CONFLICT (token)
    DO UPDATE SET user_id = ${userId}, platform = ${platform}, updated_at = NOW()
  `);
}
async function removePushToken(token) {
  await db.execute(sql3`DELETE FROM push_tokens WHERE token = ${token}`);
}
async function removePushTokenForUser(token, userId) {
  await db.execute(sql3`DELETE FROM push_tokens WHERE token = ${token} AND user_id = ${userId}`);
}
async function removeUserPushTokens(userId) {
  await db.execute(sql3`DELETE FROM push_tokens WHERE user_id = ${userId}`);
}
async function clearAllPushTokens() {
  const countResult = await db.execute(sql3`SELECT COUNT(*) as count FROM push_tokens`);
  const rows = countResult?.rows ?? Array.from(countResult ?? []);
  const count = parseInt(rows[0]?.count ?? "0", 10);
  await db.execute(sql3`DELETE FROM push_tokens`);
  return count;
}
async function getAllTokensNoPrefs() {
  const result = await db.execute(sql3`
    SELECT DISTINCT pt.token, pt.platform
    FROM push_tokens pt
    LEFT JOIN user_preferences up ON pt.user_id = up.user_id
    WHERE (up.notifications_enabled IS NULL OR up.notifications_enabled = true)
      AND (up.prediction_alerts IS NULL OR up.prediction_alerts = true)
  `);
  const rows = result?.rows ?? Array.from(result ?? []);
  return rows.filter((r) => r.token).map((r) => ({ token: r.token, platform: r.platform ?? "unknown" }));
}
async function sendExpoMessages(messages2) {
  if (messages2.length === 0) return { success: 0, failed: 0 };
  let success = 0;
  let failed = 0;
  const chunks = [];
  for (let i = 0; i < messages2.length; i += 100) {
    chunks.push(messages2.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk)
      });
      if (!response.ok) {
        console.error("[Push] Expo API error:", response.status, await response.text());
        failed += chunk.length;
        continue;
      }
      const result = await response.json();
      const tickets = result.data || [];
      const errorSamples = {};
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === "ok") {
          success++;
        } else {
          failed++;
          const errCode = ticket.details?.error || ticket.message || "unknown";
          errorSamples[errCode] = (errorSamples[errCode] || 0) + 1;
          if (ticket.details?.error === "DeviceNotRegistered" || ticket.details?.error === "InvalidCredentials") {
            await removePushToken(chunk[i].to);
          }
        }
      }
      if (Object.keys(errorSamples).length > 0) {
        console.warn("[Push] Expo ticket errors:", JSON.stringify(errorSamples));
      }
    } catch (err) {
      console.error("[Push] Expo send error:", err);
      failed += chunk.length;
    }
  }
  return { success, failed };
}
async function sendNotificationsToAll(title, body, data) {
  const tokens = await getAllTokensNoPrefs();
  if (tokens.length === 0) {
    console.log("[Push] No push tokens registered, skipping notification");
    return;
  }
  const nativeIos = [];
  const expoTokens = [];
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
    } catch (err) {
      iosFailed++;
      const msg = err?.message ?? "";
      if (msg.includes("BadDeviceToken") || msg.includes("Unregistered")) {
        await removePushToken(t.token);
      } else {
        console.warn(`[APNs] Send failed for token: ${msg}`);
      }
    }
  }
  const expoMessages = expoTokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: "default",
    badge: 1,
    ...t.platform === "android" ? { channelId: "predictions" } : {}
  }));
  const { success: expoSuccess, failed: expoFailed } = await sendExpoMessages(expoMessages);
  const totalSuccess = iosSuccess + expoSuccess;
  const totalFailed = iosFailed + expoFailed;
  console.log(
    `[Push] Sent to ${tokens.length} devices: ${totalSuccess} succeeded, ${totalFailed} failed` + (nativeIos.length > 0 ? ` (${iosSuccess}/${nativeIos.length} direct APNs)` : "") + (expoTokens.length > 0 ? ` (${expoSuccess}/${expoTokens.length} via Expo)` : "")
  );
}
async function notifyDailyFreePredictionReady() {
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
var EXPO_PUSH_API, APNS_HOST, APNS_BUNDLE_ID, apnsJwt, apnsJwtExpiry, apnsClient;
var init_pushNotificationService = __esm({
  "server/services/pushNotificationService.ts"() {
    "use strict";
    init_db();
    EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
    APNS_HOST = "api.push.apple.com";
    APNS_BUNDLE_ID = "app.probaly.logic";
    apnsJwt = null;
    apnsJwtExpiry = 0;
    apnsClient = null;
  }
});

// server/services/telegramService.ts
var telegramService_exports = {};
__export(telegramService_exports, {
  disconnectTelegramClient: () => disconnectTelegramClient,
  initTelegramService: () => initTelegramService
});
import express from "express";
import * as fs2 from "fs/promises";
import * as path2 from "path";
import { sql as sql6 } from "drizzle-orm";
async function ensureTable() {
  await db.execute(sql6`
    CREATE TABLE IF NOT EXISTS telegram_media (
      id SERIAL PRIMARY KEY,
      telegram_message_id BIGINT NOT NULL UNIQUE,
      media_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      caption TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    )
  `);
  await db.execute(sql6`
    CREATE INDEX IF NOT EXISTS idx_telegram_media_expires_at ON telegram_media(expires_at)
  `);
  await db.execute(sql6`
    ALTER TABLE telegram_media ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP
  `);
  await db.execute(sql6`
    CREATE INDEX IF NOT EXISTS idx_telegram_media_activated_at ON telegram_media(activated_at)
  `);
}
function todayInET() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(/* @__PURE__ */ new Date());
}
function currentHourInET() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false
  });
  const parts = fmt.formatToParts(/* @__PURE__ */ new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}
async function rotateDailyDisplay() {
  try {
    const result = await db.execute(sql6`
      UPDATE telegram_media
      SET activated_at = NOW(),
          expires_at = NOW() + INTERVAL '24 hours'
      WHERE id IN (
        SELECT id FROM telegram_media
        ORDER BY created_at DESC
        LIMIT ${MAX_DISPLAY_ITEMS}
      )
      RETURNING id
    `);
    const rows = result.rows || result || [];
    console.log(
      `[telegram] rotation activated ${rows.length} item(s) for the next 24h`
    );
    return rows.length;
  } catch (e) {
    console.warn("[telegram] rotation failed:", e.message);
    return -1;
  }
}
async function checkRotation() {
  try {
    const dateET = todayInET();
    const hourET = currentHourInET();
    if (hourET >= ROTATION_HOUR_ET && lastRotationDateET !== dateET) {
      const n = await rotateDailyDisplay();
      if (n > 0) lastRotationDateET = dateET;
    }
  } catch (e) {
    console.warn("[telegram] rotation check failed:", e.message);
  }
}
async function ensureInitialRotation() {
  try {
    const result = await db.execute(sql6`
      SELECT COUNT(*)::int AS n FROM telegram_media
      WHERE activated_at IS NOT NULL AND expires_at > NOW()
    `);
    const rows = result.rows || result || [];
    const n = Number(rows[0]?.n ?? 0);
    if (n === 0) {
      console.log(
        "[telegram] no active display items found \u2014 running initial rotation"
      );
      const activated = await rotateDailyDisplay();
      if (activated > 0 && currentHourInET() >= ROTATION_HOUR_ET) {
        lastRotationDateET = todayInET();
      }
    }
  } catch (e) {
    console.warn(
      "[telegram] initial rotation check failed:",
      e.message
    );
  }
}
async function ensureUploadDir() {
  await fs2.mkdir(UPLOAD_DIR, { recursive: true });
}
async function cleanupExpired() {
  try {
    const result = await db.execute(sql6`
      DELETE FROM telegram_media
      WHERE expires_at <= NOW()
      RETURNING file_path
    `);
    const rows = result.rows || result || [];
    for (const row of rows) {
      const filePath = path2.join(UPLOAD_DIR, row.file_path);
      try {
        await fs2.unlink(filePath);
      } catch {
      }
    }
    if (rows.length > 0) {
      console.log(`[telegram] cleanup removed ${rows.length} expired item(s)`);
    }
    try {
      const onDisk = await fs2.readdir(UPLOAD_DIR);
      if (onDisk.length > 0) {
        const live = await db.execute(
          sql6`SELECT file_path FROM telegram_media`
        );
        const liveRows = live.rows || live || [];
        const liveSet = new Set(liveRows.map((r) => r.file_path));
        const graceMs = 5 * 60 * 1e3;
        const now = Date.now();
        let orphans = 0;
        for (const name of onDisk) {
          if (liveSet.has(name)) continue;
          try {
            const stat2 = await fs2.stat(path2.join(UPLOAD_DIR, name));
            if (now - stat2.mtimeMs < graceMs) continue;
            await fs2.unlink(path2.join(UPLOAD_DIR, name));
            orphans++;
          } catch {
          }
        }
        if (orphans > 0) {
          console.log(`[telegram] disk sweep removed ${orphans} orphan file(s)`);
        }
      }
    } catch {
    }
  } catch (e) {
    console.warn("[telegram] cleanup failed:", e.message);
  }
}
async function getActiveMedia() {
  const result = await db.execute(sql6`
    SELECT id, telegram_message_id, media_type, file_path, mime_type,
           width, height, caption, created_at, expires_at
    FROM telegram_media
    WHERE activated_at IS NOT NULL AND expires_at > NOW()
    ORDER BY activated_at DESC, created_at DESC
    LIMIT ${MAX_DISPLAY_ITEMS}
  `);
  const rows = result.rows || result || [];
  return rows.map((r) => ({
    id: r.id,
    type: r.media_type,
    url: `${PUBLIC_PREFIX}/${r.file_path}`,
    mimeType: r.mime_type,
    width: r.width,
    height: r.height,
    caption: r.caption,
    createdAt: r.created_at,
    expiresAt: r.expires_at
  }));
}
async function ingestMessage(client, msg, Api) {
  const messageId = BigInt(msg.id);
  const media = msg.media;
  let mediaType = null;
  let mimeType = null;
  let width = null;
  let height = null;
  let ext = "bin";
  let sizeBytes = 0;
  const className = media?.className || "";
  if (className === "MessageMediaPhoto" || media instanceof Api.MessageMediaPhoto) {
    mediaType = "photo";
    mimeType = "image/jpeg";
    ext = "jpg";
    const photo = media.photo;
    const sizes = photo?.sizes || [];
    let largest = null;
    for (const s of sizes) {
      const sz = Number(s?.size || 0);
      if (!largest || sz > Number(largest.size || 0)) largest = s;
    }
    if (largest) {
      width = largest.w || null;
      height = largest.h || null;
      sizeBytes = Number(largest.size || 0);
    }
  } else if (className === "MessageMediaDocument" || media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    const mime = doc?.mimeType || "";
    sizeBytes = Number(doc?.size || 0);
    if (mime.startsWith("video/")) {
      mediaType = "video";
      mimeType = mime;
      ext = mime.split("/")[1] || "mp4";
      const va = doc?.attributes?.find((a) => a.className === "DocumentAttributeVideo");
      if (va) {
        width = va.w || null;
        height = va.h || null;
      }
    } else if (mime.startsWith("image/")) {
      mediaType = "photo";
      mimeType = mime;
      ext = mime.split("/")[1] || "jpg";
    }
  }
  if (!mediaType) return false;
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    console.warn(
      `[telegram] skipping message ${messageId} \u2014 too large (${sizeBytes} bytes)`
    );
    return false;
  }
  const existing = await db.execute(sql6`
    SELECT id FROM telegram_media WHERE telegram_message_id = ${messageId.toString()} LIMIT 1
  `);
  const existingRows = existing.rows || existing || [];
  if (existingRows.length > 0) return false;
  const postedAtSecs = Number(msg.date || 0) || Math.floor(Date.now() / 1e3);
  const ageMs = Date.now() - postedAtSecs * 1e3;
  if (ageMs >= 24 * 60 * 60 * 1e3) {
    return false;
  }
  const buffer = await client.downloadMedia(msg, {});
  if (!buffer || !buffer.length) return false;
  const filename = `${postedAtSecs}_${messageId.toString()}.${ext}`;
  const fullPath = path2.join(UPLOAD_DIR, filename);
  await fs2.writeFile(fullPath, buffer);
  const caption = msg.message || null;
  try {
    const inserted = await db.execute(sql6`
      INSERT INTO telegram_media
        (telegram_message_id, media_type, file_path, mime_type, width, height, caption, created_at, expires_at)
      VALUES (
        ${messageId.toString()}, ${mediaType}, ${filename}, ${mimeType},
        ${width}, ${height}, ${caption},
        to_timestamp(${postedAtSecs}),
        to_timestamp(${postedAtSecs}) + INTERVAL '24 hours'
      )
      ON CONFLICT (telegram_message_id) DO NOTHING
      RETURNING id
    `);
    const insertedRows = inserted.rows || inserted || [];
    if (insertedRows.length === 0) {
      try {
        await fs2.unlink(fullPath);
      } catch {
      }
      return false;
    }
    console.log(
      `[telegram] ingested ${mediaType} message=${messageId} file=${filename} size=${sizeBytes}`
    );
    return true;
  } catch (e) {
    try {
      await fs2.unlink(fullPath);
    } catch {
    }
    throw e;
  }
}
async function backfillRecent(client, Api) {
  if (!resolvedChannelId) return 0;
  try {
    const peer = new Api.PeerChannel({ channelId: resolvedChannelId });
    const messages2 = await client.getMessages(peer, { limit: 30 });
    let newCount = 0;
    for (const m of messages2) {
      if (!m?.media) continue;
      try {
        const wasNew = await ingestMessage(client, m, Api);
        if (wasNew) newCount++;
      } catch (err) {
        console.warn(
          "[telegram] backfill message failed:",
          err.message
        );
      }
    }
    console.log(
      `[telegram] backfill checked ${messages2.length} recent message(s), ${newCount} new`
    );
    return newCount;
  } catch (e) {
    console.warn("[telegram] backfill failed:", e.message);
    return 0;
  }
}
function withTimeout2(p, ms, label) {
  return Promise.race([
    p,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}
async function resetTelegramState(reason) {
  if (isConnecting) {
    console.log(`[telegram] reset skipped (connect in flight): ${reason}`);
    return;
  }
  console.log(`[telegram] resetting state: ${reason}`);
  if (telegramClient) {
    try {
      await telegramClient.disconnect();
    } catch {
    }
  }
  telegramClient = null;
  telegramApiRef = null;
  resolvedChannelId = null;
  listenerStarted = false;
  isConnectingSince = null;
}
async function pollForNewMedia() {
  const clientConnected = telegramClient?.connected !== false;
  const clientHealthy = telegramClient && telegramApiRef && resolvedChannelId && clientConnected;
  if (!clientHealthy) {
    if (isConnecting) {
      const heldFor = isConnectingSince ? Date.now() - isConnectingSince : 0;
      if (heldFor < STALE_CONNECTING_MS) {
        console.log(
          `[telegram] poll: connect already in flight (${Math.round(heldFor / 1e3)}s), deferring to next cycle`
        );
        return;
      }
      console.warn(
        `[telegram] poll: stale connect lock (${Math.round(heldFor / 1e3)}s) \u2014 force-clearing and reconnecting`
      );
      isConnecting = false;
      isConnectingSince = null;
    }
    const reason = !telegramClient ? "no client" : !telegramApiRef || !resolvedChannelId ? "incomplete setup" : "client disconnected";
    console.log(`[telegram] poll: client not ready (${reason}) \u2014 reconnecting...`);
    await resetTelegramState(reason);
    await startTelegramListener();
    if (!telegramClient || !telegramApiRef || !resolvedChannelId) {
      console.log("[telegram] poll: connection retry failed, will try again next cycle");
      return;
    }
  }
  try {
    console.log("[telegram] poll: checking for new media...");
    const newCount = await backfillRecent(telegramClient, telegramApiRef);
    if (newCount > 0) {
      console.log(`[telegram] poll: ${newCount} new item(s) \u2014 rotating gallery`);
      const n = await rotateDailyDisplay();
      if (n > 0 && currentHourInET() >= ROTATION_HOUR_ET) {
        lastRotationDateET = todayInET();
      }
    }
  } catch (e) {
    const errMsg = e.message || "";
    console.warn("[telegram] poll error:", errMsg);
    if (errMsg.includes("TIMEOUT") || errMsg.includes("Not connected") || errMsg.includes("DISCONNECTED") || errMsg.includes("closed") || errMsg.includes("AUTH_KEY") || telegramClient?.connected === false) {
      await resetTelegramState(`api error: ${errMsg.slice(0, 80)}`);
    }
  }
}
async function startTelegramListener() {
  if (listenerStarted || isConnecting) return;
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[telegram] listener skipped in development mode (runs in production only)"
    );
    return;
  }
  isConnecting = true;
  isConnectingSince = Date.now();
  const apiIdRaw = process.env.TELEGRAM_API_ID || "";
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const sessionString = process.env.TELEGRAM_SESSION_STRING || "";
  const apiId = parseInt(apiIdRaw, 10);
  if (!apiId || !apiHash || !sessionString) {
    console.log(
      "[telegram] secrets not configured \u2014 listener disabled (polling-only mode)"
    );
    isConnecting = false;
    isConnectingSince = null;
    return;
  }
  console.log("[telegram] starting listener, apiId present, importing gramjs...");
  try {
    const tg = await import("telegram");
    const sessionsMod = await import("telegram/sessions/index.js");
    const eventsMod = await import("telegram/events/index.js");
    const { TelegramClient, Api } = tg;
    const { StringSession } = sessionsMod;
    const { NewMessage } = eventsMod;
    console.log("[telegram] gramjs imported, creating client...");
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      // connectionRetries: 0 — we manage retries ourselves via pollForNewMedia.
      // gramjs's internal retry loop creates new auth key negotiation attempts
      // on each retry, which compounds AUTH_KEY_DUPLICATED conflicts.
      connectionRetries: 0
    });
    if (client.setLogLevel) {
      try {
        client.setLogLevel("error");
      } catch {
      }
    }
    telegramClient = client;
    console.log("[telegram] connecting (timeout 30s)...");
    await Promise.race([
      client.connect(),
      new Promise(
        (_, reject) => setTimeout(
          () => reject(new Error("connect() timed out after 30s")),
          CONNECT_TIMEOUT_MS
        )
      )
    ]);
    console.log("[telegram] connected, checking authorization...");
    const authorized = await withTimeout2(
      client.isUserAuthorized(),
      GRAMJS_CALL_TIMEOUT_MS,
      "isUserAuthorized"
    );
    console.log(`[telegram] isUserAuthorized=${authorized}`);
    if (!authorized) {
      console.error(
        "[telegram] session string is not authorized \u2014 re-run scripts/telegramLogin.ts"
      );
      isConnecting = false;
      isConnectingSince = null;
      return;
    }
    console.log("[telegram] resolving channel...");
    try {
      const res = await withTimeout2(
        client.invoke(new Api.messages.ImportChatInvite({ hash: INVITE_HASH })),
        GRAMJS_CALL_TIMEOUT_MS,
        "ImportChatInvite"
      );
      const chat = res?.chats?.[0];
      if (chat?.id) resolvedChannelId = BigInt(chat.id.toString());
    } catch (e) {
      const msg = e?.errorMessage || e?.message || "";
      if (msg.includes("USER_ALREADY_PARTICIPANT")) {
        try {
          const inv = await withTimeout2(
            client.invoke(new Api.messages.CheckChatInvite({ hash: INVITE_HASH })),
            GRAMJS_CALL_TIMEOUT_MS,
            "CheckChatInvite"
          );
          const chat = inv?.chat;
          if (chat?.id) resolvedChannelId = BigInt(chat.id.toString());
        } catch (e2) {
          console.error(
            "[telegram] CheckChatInvite failed:",
            e2?.errorMessage || e2?.message
          );
        }
      } else {
        console.error("[telegram] failed to resolve channel:", msg);
      }
    }
    if (!resolvedChannelId) {
      console.error(
        "[telegram] could not determine channel id \u2014 event handler disabled (polling still active)"
      );
      isConnecting = false;
      isConnectingSince = null;
      return;
    }
    telegramClient = client;
    telegramApiRef = Api;
    listenerStarted = true;
    isConnecting = false;
    isConnectingSince = null;
    console.log(`[telegram] listening to channel id=${resolvedChannelId}`);
    void (async () => {
      const newCount = await backfillRecent(client, Api);
      if (newCount > 0) {
        const n = await rotateDailyDisplay();
        if (n > 0 && currentHourInET() >= ROTATION_HOUR_ET) {
          lastRotationDateET = todayInET();
        }
      } else {
        await ensureInitialRotation();
      }
    })();
    client.addEventHandler(async (event) => {
      try {
        const msg = event.message;
        if (!msg?.media) return;
        const peer = msg.peerId;
        const peerChannelId = peer?.channelId ? BigInt(peer.channelId.toString()) : null;
        if (!peerChannelId || peerChannelId !== resolvedChannelId) return;
        const wasNew = await ingestMessage(client, msg, Api);
        if (wasNew) {
          const n = await rotateDailyDisplay();
          if (n > 0 && currentHourInET() >= ROTATION_HOUR_ET) {
            lastRotationDateET = todayInET();
          }
        }
      } catch (err) {
        console.warn("[telegram] handler error:", err.message);
      }
    }, new NewMessage({}));
    client.session.save();
  } catch (e) {
    const errMsg = e.message || "";
    if (errMsg.includes("AUTH_KEY_DUPLICATED")) {
      console.warn(
        "[telegram] AUTH_KEY_DUPLICATED \u2014 disconnecting and backing off 2 min before retry..."
      );
      try {
        await telegramClient?.disconnect();
      } catch {
      }
      telegramClient = null;
      await new Promise((resolve3) => setTimeout(resolve3, 2 * 60 * 1e3));
    } else {
      console.error("[telegram] failed to start listener:", errMsg);
    }
    isConnecting = false;
    isConnectingSince = null;
  }
}
async function disconnectTelegramClient() {
  if (telegramClient) {
    try {
      await telegramClient.disconnect();
    } catch {
    }
    telegramClient = null;
  }
}
async function initTelegramService(app2) {
  try {
    await ensureTable();
    await ensureUploadDir();
    app2.use(
      PUBLIC_PREFIX,
      express.static(UPLOAD_DIR, { maxAge: "1h", fallthrough: true })
    );
    app2.get("/api/landing/telegram-media", async (_req, res) => {
      try {
        const items = await getActiveMedia();
        res.setHeader("Cache-Control", "public, max-age=30");
        res.json({ items });
      } catch (e) {
        console.warn("[telegram] api error:", e.message);
        res.json({ items: [] });
      }
    });
    setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
    void cleanupExpired();
    setInterval(checkRotation, ROTATION_CHECK_INTERVAL_MS);
    void ensureInitialRotation();
    void startTelegramListener();
    setTimeout(() => void pollForNewMedia(), FIRST_POLL_DELAY_MS);
    setInterval(() => void pollForNewMedia(), POLL_INTERVAL_MS);
    console.log("[telegram] service initialized");
  } catch (e) {
    console.error("[telegram] init failed:", e.message);
  }
}
var UPLOAD_DIR, PUBLIC_PREFIX, MAX_DISPLAY_ITEMS, CLEANUP_INTERVAL_MS, ROTATION_CHECK_INTERVAL_MS, POLL_INTERVAL_MS, FIRST_POLL_DELAY_MS, ROTATION_HOUR_ET, MAX_FILE_SIZE_BYTES, INVITE_HASH, GRAMJS_CALL_TIMEOUT_MS, STALE_CONNECTING_MS, isConnectingSince, CONNECT_TIMEOUT_MS, listenerStarted, isConnecting, resolvedChannelId, lastRotationDateET, telegramClient, telegramApiRef;
var init_telegramService = __esm({
  "server/services/telegramService.ts"() {
    "use strict";
    init_db();
    UPLOAD_DIR = path2.resolve(process.cwd(), "server", "uploads", "telegram");
    PUBLIC_PREFIX = "/uploads/telegram";
    MAX_DISPLAY_ITEMS = 3;
    CLEANUP_INTERVAL_MS = 10 * 60 * 1e3;
    ROTATION_CHECK_INTERVAL_MS = 60 * 1e3;
    POLL_INTERVAL_MS = 90 * 1e3;
    FIRST_POLL_DELAY_MS = 45 * 1e3;
    ROTATION_HOUR_ET = 11;
    MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
    INVITE_HASH = process.env.TELEGRAM_INVITE_HASH || "5uZNUktfpeZiMjVi";
    GRAMJS_CALL_TIMEOUT_MS = 15e3;
    STALE_CONNECTING_MS = 9e4;
    isConnectingSince = null;
    CONNECT_TIMEOUT_MS = 3e4;
    listenerStarted = false;
    isConnecting = false;
    resolvedChannelId = null;
    lastRotationDateET = null;
    telegramClient = null;
    telegramApiRef = null;
  }
});

// server/index.ts
import express2 from "express";
import { runMigrations } from "stripe-replit-sync";

// server/routes.ts
import { createServer } from "node:http";

// server/storage.ts
init_schema();
init_db();
import { eq, desc, sql as sql2 } from "drizzle-orm";

// server/stripeClient.ts
import Stripe from "stripe";
var connectionSettings;
async function getCredentials() {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY) {
    return {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY
    };
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "X_REPLIT_TOKEN": xReplitToken
    }
  });
  const data = await response.json();
  connectionSettings = data.items?.[0];
  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }
  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret
  };
}
async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover"
  });
}
async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}
async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}
var stripeSync = null;
async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import("stripe-replit-sync");
    const secretKey = await getStripeSecretKey();
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL,
        max: 2
      },
      stripeSecretKey: secretKey
    });
  }
  return stripeSync;
}

// server/storage.ts
function extractRows(result) {
  return result?.rows ?? Array.from(result ?? []);
}
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async getUserByStripeCustomerId(customerId) {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user;
  }
  async createUser(insertUser, referralCode) {
    const [user] = await db.insert(users).values({
      ...insertUser,
      referredByCode: referralCode?.toUpperCase() || null
    }).returning();
    return user;
  }
  async updateUserStripeInfo(userId, stripeInfo) {
    const [user] = await db.update(users).set(stripeInfo).where(eq(users.id, userId)).returning();
    return user;
  }
  async getUserPreferences(userId) {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return prefs;
  }
  async saveUserPreferences(userId, prefs) {
    const existing = await this.getUserPreferences(userId);
    if (existing) {
      const [updated] = await db.update(userPreferences).set({ ...prefs, updatedAt: /* @__PURE__ */ new Date() }).where(eq(userPreferences.userId, userId)).returning();
      return updated;
    } else {
      const [created] = await db.insert(userPreferences).values({ userId, ...prefs }).returning();
      return created;
    }
  }
  async getProduct(productId) {
    const result = await db.execute(
      sql2`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return extractRows(result)[0] || null;
  }
  async listProducts(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql2`SELECT * FROM stripe.products WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return extractRows(result);
  }
  async listProductsWithPrices(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql2`
        WITH paginated_products AS (
          SELECT id, name, description, metadata, active
          FROM stripe.products
          WHERE active = ${active}
          ORDER BY id
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active,
          pr.metadata as price_metadata
        FROM paginated_products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        ORDER BY p.id, pr.unit_amount
      `
    );
    const rows = extractRows(result);
    if (rows.length === 0) {
      try {
        const stripe = await getUncachableStripeClient();
        const products = await stripe.products.list({ active: true, limit: 20 });
        const productsWithPrices = [];
        for (const product of products.data) {
          const prices = await stripe.prices.list({ product: product.id, active: true });
          if (prices.data.length === 0) {
            productsWithPrices.push({
              product_id: product.id,
              product_name: product.name,
              product_description: product.description,
              product_active: product.active,
              product_metadata: product.metadata,
              price_id: null,
              unit_amount: null,
              currency: null,
              recurring: null,
              price_active: null
            });
          } else {
            for (const price of prices.data) {
              productsWithPrices.push({
                product_id: product.id,
                product_name: product.name,
                product_description: product.description,
                product_active: product.active,
                product_metadata: product.metadata,
                price_id: price.id,
                unit_amount: price.unit_amount,
                currency: price.currency,
                recurring: price.recurring,
                price_active: price.active,
                price_metadata: price.metadata
              });
            }
          }
        }
        return productsWithPrices;
      } catch (error) {
        console.error("Failed to fetch from Stripe API:", error);
        return [];
      }
    }
    return rows;
  }
  async getPrice(priceId) {
    const result = await db.execute(
      sql2`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return extractRows(result)[0] || null;
  }
  async listPrices(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql2`SELECT * FROM stripe.prices WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return extractRows(result);
  }
  async getPricesForProduct(productId) {
    const result = await db.execute(
      sql2`SELECT * FROM stripe.prices WHERE product = ${productId} AND active = true`
    );
    return extractRows(result);
  }
  async getSubscription(subscriptionId) {
    const result = await db.execute(
      sql2`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return extractRows(result)[0] || null;
  }
  async createContactSubmission(data) {
    const result = await db.insert(contactSubmissions).values(data).returning();
    return result[0];
  }
  async getContactSubmissions(status) {
    if (status) {
      return db.select().from(contactSubmissions).where(eq(contactSubmissions.status, status)).orderBy(desc(contactSubmissions.createdAt));
    }
    return db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }
  // Anonymize user data to satisfy Apple's account deletion requirement.
  // Keeps the row (preserving referential integrity with referrals/affiliates)
  // but scrubs all personal information and revokes access.
  async deleteUser(userId) {
    await db.update(users).set({
      email: `deleted_${userId}@deleted.invalid`,
      password: "DELETED",
      name: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      isPremium: false,
      subscriptionExpiry: null
    }).where(eq(users.id, userId));
  }
};
var storage = new DatabaseStorage();

// server/stripeService.ts
var StripeService = class {
  async createCustomer(email, userId) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId }
    });
  }
  async getCustomer(customerId) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.retrieve(customerId);
  }
  async createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl
    });
  }
  async createCustomerPortalSession(customerId, returnUrl) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
  }
  async getProduct(productId) {
    return await storage.getProduct(productId);
  }
  async getSubscription(subscriptionId) {
    return await storage.getSubscription(subscriptionId);
  }
  async getActiveSubscription(customerId) {
    const stripe = await getUncachableStripeClient();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1
    });
    return subscriptions.data[0] || null;
  }
};
var stripeService = new StripeService();

// server/routes.ts
import { z } from "zod";
import bcrypt from "bcryptjs";

// server/auth.ts
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.REPLIT_DEPLOYMENT === "1") {
    throw new Error("JWT_SECRET must be set in production");
  }
  if (process.env.DATABASE_URL) {
    return createHash("sha256").update(process.env.DATABASE_URL).digest("hex");
  }
  return "fallback-dev-secret-not-for-production";
}
var JWT_EXPIRY = "365d";
function signToken(userId, tokenVersion) {
  return jwt.sign(
    { sub: userId, tv: tokenVersion },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRY }
  );
}
function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}
var TOKEN_VERSION_TTL_MS = 6e4;
var tokenVersionCache = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokenVersionCache) {
    if (v.expiresAt < now) tokenVersionCache.delete(k);
  }
}, 5 * 6e4);
function setCachedTokenVersion(userId, version) {
  tokenVersionCache.set(userId, {
    version,
    expiresAt: Date.now() + TOKEN_VERSION_TTL_MS
  });
}
async function getCurrentTokenVersion(userId) {
  const cached = tokenVersionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.version;
  try {
    const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { sql: sql7 } = await import("drizzle-orm");
    const result = await db2.execute(
      sql7`SELECT token_version FROM users WHERE id = ${userId}`
    );
    const rows = Array.isArray(result) ? result : result?.rows ?? [];
    if (rows.length === 0) return null;
    const version = Number(rows[0]?.token_version ?? 0);
    setCachedTokenVersion(userId, version);
    return version;
  } catch (err) {
    console.warn("[AUTH] token_version lookup failed:", err.message);
    return null;
  }
}
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required", code: "NO_TOKEN" });
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
  }
  const currentVersion = await getCurrentTokenVersion(payload.sub);
  const tokenTv = typeof payload.tv === "number" ? payload.tv : 0;
  if (currentVersion !== null && tokenTv !== currentVersion) {
    return res.status(401).json({
      error: "Your session ended because this account signed in on another device.",
      code: "SESSION_REVOKED"
    });
  }
  req.userId = payload.sub;
  next();
}
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload?.sub) {
      const currentVersion = await getCurrentTokenVersion(payload.sub);
      const tokenTv = typeof payload.tv === "number" ? payload.tv : 0;
      if (currentVersion !== null && tokenTv !== currentVersion) {
        return res.status(401).json({
          error: "Your session ended because this account signed in on another device.",
          code: "SESSION_REVOKED"
        });
      }
      req.userId = payload.sub;
    }
  }
  next();
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  try {
    const { timingSafeEqual: tse } = __require("crypto");
    return tse(bufA, bufB);
  } catch {
    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
      result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
  }
}
function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(503).json({ error: "Admin access not configured" });
  }
  const providedKey = req.headers["x-admin-key"];
  if (!providedKey || !timingSafeEqual(providedKey, adminKey)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
var rateLimitStore = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 6e4);
var rateLimitCounter = 0;
function rateLimit(options) {
  const scope = `rl_${++rateLimitCounter}`;
  return (req, res, next) => {
    const ip = options.keyGenerator ? options.keyGenerator(req) : req.ip || req.headers["x-forwarded-for"] || "unknown";
    const key = `${scope}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1e3);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}

// server/revenueCatService.ts
import { createClient } from "@replit/revenuecat-sdk/client";
import { listCustomerActiveEntitlements } from "@replit/revenuecat-sdk";
var REVENUECAT_PROJECT_ID = process.env.REVENUECAT_PROJECT_ID || "projdf936295";
async function getRCClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!hostname || !xReplitToken) return null;
  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken
        }
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const conn = data.items?.[0];
    const accessToken = conn?.settings?.access_token || conn?.settings?.oauth?.credentials?.access_token;
    if (!accessToken) return null;
    return createClient({
      baseUrl: "https://api.revenuecat.com/v2",
      headers: { Authorization: "Bearer " + accessToken }
    });
  } catch {
    return null;
  }
}
async function checkRCSubscription(userId) {
  const client = await getRCClient();
  if (!client) {
    console.log("[RC] No client available \u2014 skipping RC check");
    return null;
  }
  try {
    const { data, error } = await listCustomerActiveEntitlements({
      client,
      path: {
        project_id: REVENUECAT_PROJECT_ID,
        customer_id: userId
      }
    });
    if (error) {
      console.log(`[RC] Active entitlements lookup failed for user ${userId}:`, error?.type ?? error);
      return null;
    }
    const items = data?.items ?? [];
    if (items.length === 0) {
      return { isPremium: false };
    }
    const first = items[0];
    const expiresAtMs = first.expires_at ?? null;
    const expiryDate = expiresAtMs != null ? new Date(expiresAtMs) : null;
    if (expiryDate && expiryDate <= /* @__PURE__ */ new Date()) {
      return { isPremium: false };
    }
    console.log(`[RC] Active entitlement found for user ${userId}, expires: ${expiryDate?.toISOString() ?? "never"}`);
    return {
      isPremium: true,
      expiryDate: expiryDate ?? void 0
    };
  } catch (error) {
    console.error("[RC] checkRCSubscription error:", error);
    return null;
  }
}

// server/emailValidation.ts
import { promises as dns } from "node:dns";
var DNS_TIMEOUT_MS = 4e3;
var CACHE_TTL_MS = 60 * 60 * 1e3;
var domainCache = /* @__PURE__ */ new Map();
var DISPOSABLE_DOMAINS = /* @__PURE__ */ new Set([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "mintemail.com",
  "mailnesia.com",
  "mohmal.com",
  "maildrop.cc",
  "mailcatch.com",
  "mailbox.org",
  "spambog.com",
  "spamgourmet.com",
  "moakt.com",
  "mailtemp.info",
  "tempr.email",
  "tempinbox.com",
  "fakemail.net",
  "emailondeck.com",
  "anonbox.net",
  "deadaddress.com",
  "throwaway.email",
  "instantemailaddress.com",
  "harakirimail.com",
  "burnermail.io",
  "mytemp.email",
  "qowo.com",
  "gausi.com",
  "jui.com",
  "gma.com"
]);
var INVALID_MX_HOSTS = /* @__PURE__ */ new Set([
  "",
  ".",
  "localhost",
  "localhost.",
  "0.0.0.0",
  "127.0.0.1",
  "::",
  "::1",
  "0"
]);
function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms)
    )
  ]);
}
function isTransientDnsError(err) {
  const code = err?.code;
  if (!code) return /TIMEOUT/.test(String(err?.message || ""));
  return code === "ETIMEOUT" || code === "ESERVFAIL" || code === "EREFUSED" || code === "ECONNREFUSED";
}
async function checkMx(domain) {
  try {
    const records = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS, "MX");
    if (!Array.isArray(records) || records.length === 0) return "no_records";
    const hasNullMx = records.some((r) => {
      const ex = (r.exchange || "").trim().toLowerCase();
      const prio = r.priority;
      return (ex === "" || ex === ".") && (prio === 0 || prio === void 0);
    });
    if (hasNullMx) return "null_mx";
    const validExchanges = records.filter((r) => {
      const ex = (r.exchange || "").trim().toLowerCase().replace(/\.$/, "");
      return ex.length > 0 && !INVALID_MX_HOSTS.has(ex) && ex.includes(".");
    });
    if (validExchanges.length > 0) return "yes";
    return "bogus_mx";
  } catch (err) {
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") return "no_records";
    if (isTransientDnsError(err)) return "transient";
    return "no_records";
  }
}
async function checkAddressRecord(domain) {
  const v4 = withTimeout(dns.resolve4(domain), DNS_TIMEOUT_MS, "A").then(
    (r) => r && r.length > 0 ? "yes" : "no",
    (err) => isTransientDnsError(err) ? "transient" : "no"
  );
  const v6 = withTimeout(dns.resolve6(domain), DNS_TIMEOUT_MS, "AAAA").then(
    (r) => r && r.length > 0 ? "yes" : "no",
    (err) => isTransientDnsError(err) ? "transient" : "no"
  );
  const [a, aaaa] = await Promise.all([v4, v6]);
  if (a === "yes" || aaaa === "yes") return "yes";
  if (a === "transient" || aaaa === "transient") return "transient";
  return "no";
}
async function isDomainDeliverable(domain) {
  const key = domain.toLowerCase();
  if (DISPOSABLE_DOMAINS.has(key)) {
    return { deliverable: false, cacheable: true };
  }
  const cached = domainCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { deliverable: cached.deliverable, cacheable: false };
  }
  const mx = await checkMx(key);
  if (mx === "yes") return { deliverable: true, cacheable: true };
  if (mx === "null_mx") return { deliverable: false, cacheable: true };
  if (mx === "bogus_mx") return { deliverable: false, cacheable: true };
  if (mx === "no_records") {
    const addr = await checkAddressRecord(key);
    if (addr === "yes") return { deliverable: true, cacheable: true };
    if (addr === "no") return { deliverable: false, cacheable: true };
    return { deliverable: true, cacheable: false };
  }
  return { deliverable: true, cacheable: false };
}
function toAsciiDomain(domain) {
  try {
    const u = new URL(`http://${domain}`);
    return u.hostname || null;
  } catch {
    return null;
  }
}
async function validateEmailDeliverable(email) {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return { valid: false, reason: "Please enter a valid email address." };
  }
  const rawDomain = trimmed.slice(at + 1);
  if (!rawDomain || rawDomain.length > 253) {
    return { valid: false, reason: "Please enter a valid email address." };
  }
  const ascii = toAsciiDomain(rawDomain);
  if (!ascii || !ascii.includes(".") || ascii.startsWith(".") || ascii.endsWith(".") || ascii.includes("..")) {
    return { valid: false, reason: "Please enter a valid email address." };
  }
  try {
    const { deliverable, cacheable } = await isDomainDeliverable(ascii);
    if (cacheable) {
      domainCache.set(ascii.toLowerCase(), {
        deliverable,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
    }
    if (!deliverable) {
      return {
        valid: false,
        reason: "This email doesn't appear to exist. Please use a real email address."
      };
    }
    return { valid: true };
  } catch {
    return { valid: true };
  }
}

// server/routes.ts
init_db();
init_schema();
import { sql as sql5, and as and2 } from "drizzle-orm";

// server/services/predictionService.ts
init_db();
init_schema();
import OpenAI from "openai";
import { eq as eq2, and, gte, isNull, desc as desc2, asc, sql as sql4, or } from "drizzle-orm";

// server/services/sportsApiService.ts
var CACHE_TTL_MS2 = 60 * 60 * 1e3;
var matchCache = null;
var espnFallbackCache = null;
var ESPN_CACHE_TTL = 2 * 60 * 60 * 1e3;
var SPORTS_MAP = {
  football: [
    { apiKey: "soccer_epl", sportName: "football", league: "Premier League" },
    { apiKey: "soccer_spain_la_liga", sportName: "football", league: "La Liga" },
    { apiKey: "soccer_germany_bundesliga", sportName: "football", league: "Bundesliga" },
    { apiKey: "soccer_italy_serie_a", sportName: "football", league: "Serie A" },
    { apiKey: "soccer_france_ligue_one", sportName: "football", league: "Ligue 1" },
    { apiKey: "soccer_uefa_champs_league", sportName: "football", league: "Champions League" },
    { apiKey: "soccer_usa_mls", sportName: "football", league: "MLS" }
  ],
  basketball: [
    { apiKey: "basketball_nba", sportName: "basketball", league: "NBA" },
    { apiKey: "basketball_euroleague", sportName: "basketball", league: "EuroLeague" },
    { apiKey: "basketball_ncaab", sportName: "basketball", league: "NCAAB" }
  ],
  tennis: [
    { apiKey: "tennis_atp_monte_carlo_masters", sportName: "tennis", league: "ATP Monte-Carlo Masters" },
    { apiKey: "tennis_wta_charleston_open", sportName: "tennis", league: "WTA Charleston Open" }
  ],
  baseball: [
    { apiKey: "baseball_mlb", sportName: "baseball", league: "MLB" }
  ],
  hockey: [
    { apiKey: "icehockey_nhl", sportName: "hockey", league: "NHL" }
  ],
  mma: [
    { apiKey: "mma_mixed_martial_arts", sportName: "mma", league: "UFC" }
  ],
  cricket: [
    { apiKey: "cricket_ipl", sportName: "cricket", league: "IPL" },
    { apiKey: "cricket_international_t20", sportName: "cricket", league: "International T20" },
    { apiKey: "cricket_psl", sportName: "cricket", league: "PSL" }
  ],
  golf: []
};
async function fetchGamesFromApi(sportKey) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    console.log("ODDS_API_KEY not configured, using fallback data");
    return [];
  }
  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch games for ${sportKey}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching games for ${sportKey}:`, error);
    return [];
  }
}
async function getUpcomingMatchesFromApi(espnOnly = false) {
  const now = Date.now();
  if (!espnOnly && matchCache && now - matchCache.fetchedAt < CACHE_TTL_MS2) {
    const upcoming = matchCache.data.filter((m) => m.matchTime.getTime() > now);
    if (upcoming.length > 0) {
      console.log(`Using cached matches (${upcoming.length} upcoming, cache age: ${Math.round((now - matchCache.fetchedAt) / 6e4)}m)`);
      return upcoming;
    }
  }
  const apiKey = process.env.ODDS_API_KEY;
  if (espnOnly || !apiKey) {
    console.log(espnOnly ? "ESPN-only fetch requested \u2014 skipping Odds API to preserve quota" : "ODDS_API_KEY not set \u2014 fetching real matches from ESPN");
    const espnMatches = await getESPNMatches();
    matchCache = { data: espnMatches, fetchedAt: Date.now() };
    _usingFallback = true;
    return espnMatches;
  }
  const allMatches = [];
  const currentTime = /* @__PURE__ */ new Date();
  const maxFutureTime = new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1e3);
  const allConfigs = [];
  for (const configs of Object.values(SPORTS_MAP)) {
    allConfigs.push(...configs);
  }
  for (let i = 0; i < allConfigs.length; i++) {
    const config = allConfigs[i];
    if (i > 0 && i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 1e3));
    }
    const games = await fetchGamesFromApi(config.apiKey);
    const futureGames = games.filter((g) => {
      const t = new Date(g.commence_time);
      return t > currentTime && t < maxFutureTime;
    }).slice(0, 4);
    for (const game of futureGames) {
      allMatches.push({
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        sport: config.sportName,
        matchTime: new Date(game.commence_time),
        league: config.league
      });
    }
  }
  const apiMatchCount = allMatches.length;
  if (apiMatchCount === 0) {
    console.log("No real games found from sports API \u2014 fetching real matches from ESPN");
    const espnMatches = await getESPNMatches();
    matchCache = { data: espnMatches, fetchedAt: Date.now() };
    _usingFallback = true;
    return espnMatches;
  }
  allMatches.sort((a, b) => a.matchTime.getTime() - b.matchTime.getTime());
  matchCache = { data: allMatches, fetchedAt: Date.now() };
  _usingFallback = false;
  console.log(`Fetched ${allMatches.length} real upcoming matches from sports API (cached for 1 hour)`);
  return allMatches;
}
var _usingFallback = false;
function isUsingFallbackData() {
  return _usingFallback;
}
var ESPN_ENDPOINTS = [
  { url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", sport: "basketball", league: "NBA" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard", sport: "baseball", league: "MLB" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard", sport: "hockey", league: "NHL" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard", sport: "football", league: "Premier League" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard", sport: "football", league: "La Liga" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard", sport: "football", league: "Bundesliga" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard", sport: "football", league: "Serie A" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard", sport: "football", league: "Ligue 1" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard", sport: "football", league: "MLS" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard", sport: "football", league: "Champions League" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard", sport: "mma", league: "UFC" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard", sport: "tennis", league: "ATP Tour" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard", sport: "tennis", league: "WTA Tour" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/cricket/icc/scoreboard", sport: "cricket", league: "ICC" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard", sport: "golf", league: "PGA Tour" }
];
async function getESPNMatches() {
  const now = Date.now();
  if (espnFallbackCache && now - espnFallbackCache.fetchedAt < ESPN_CACHE_TTL) {
    const upcoming = espnFallbackCache.data.filter((m) => m.matchTime.getTime() > now);
    if (upcoming.length > 5) {
      console.log(`Using cached ESPN matches (${upcoming.length} upcoming)`);
      return upcoming;
    }
  }
  console.log("Fetching real upcoming matches from ESPN (free API)...");
  const allMatches = [];
  const currentTime = /* @__PURE__ */ new Date();
  const seenMatchups = /* @__PURE__ */ new Set();
  function extractFromCompetition(comp, fallbackDate, sport, league) {
    const matchTime = new Date(comp?.date || fallbackDate);
    if (isNaN(matchTime.getTime()) || matchTime < currentTime) return null;
    const statusName = comp?.status?.type?.name;
    if (statusName === "STATUS_FINAL" || statusName === "STATUS_IN_PROGRESS") return null;
    const competitors = comp?.competitors || [];
    if (competitors.length < 2) return null;
    const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0];
    const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1];
    const homeTeam = homeComp?.team?.displayName || homeComp?.athlete?.displayName || "TBD";
    const awayTeam = awayComp?.team?.displayName || awayComp?.athlete?.displayName || "TBD";
    if (homeTeam === "TBD" || awayTeam === "TBD") return null;
    const key = `${homeTeam}|${awayTeam}|${sport}`;
    if (seenMatchups.has(key)) return null;
    seenMatchups.add(key);
    return { homeTeam, awayTeam, sport, matchTime, league };
  }
  function extractGolfMatchups(event, league) {
    const out = [];
    const comp = event?.competitions?.[0];
    if (!comp) return out;
    if (comp?.status?.type?.name === "STATUS_FINAL") return out;
    const endDate = new Date(event?.endDate || comp?.endDate || event?.date);
    if (isNaN(endDate.getTime()) || endDate < currentTime) return out;
    const competitors = comp?.competitors || [];
    if (competitors.length < 2) return out;
    const ordered = [...competitors].sort(
      (a, b) => (a?.order ?? 999) - (b?.order ?? 999)
    );
    const pairCount = Math.min(3, Math.floor(ordered.length / 2));
    for (let i = 0; i < pairCount; i++) {
      const a = ordered[i * 2];
      const b = ordered[i * 2 + 1];
      const homeTeam = a?.team?.displayName || a?.athlete?.displayName;
      const awayTeam = b?.team?.displayName || b?.athlete?.displayName;
      if (!homeTeam || !awayTeam) continue;
      const key = `${homeTeam}|${awayTeam}|golf`;
      if (seenMatchups.has(key)) continue;
      seenMatchups.add(key);
      out.push({ homeTeam, awayTeam, sport: "golf", matchTime: endDate, league });
    }
    return out;
  }
  function parseESPNEvents(events, sport, league) {
    const results = [];
    const eventLimit = sport === "tennis" ? events.length : 10;
    for (const event of events.slice(0, eventLimit)) {
      const fallbackDate = event.date;
      if (sport === "golf") {
        for (const m of extractGolfMatchups(event, league)) results.push(m);
        continue;
      }
      const tennisCapHit = () => sport === "tennis" && results.length >= 30;
      if (event.competitions?.length > 0 && !tennisCapHit()) {
        for (const comp of event.competitions) {
          if (tennisCapHit()) break;
          const m = extractFromCompetition(comp, fallbackDate, sport, league);
          if (m) results.push(m);
        }
      }
      if (event.groupings?.length > 0 && !tennisCapHit()) {
        for (const group of event.groupings) {
          if (tennisCapHit()) break;
          for (const comp of group.competitions || []) {
            if (tennisCapHit()) break;
            const m = extractFromCompetition(comp, fallbackDate, sport, league);
            if (m) results.push(m);
          }
        }
      }
      if (tennisCapHit()) break;
    }
    return results;
  }
  for (const endpoint of ESPN_ENDPOINTS) {
    try {
      const response = await fetch(endpoint.url);
      if (!response.ok) continue;
      const data = await response.json();
      allMatches.push(...parseESPNEvents(data.events || [], endpoint.sport, endpoint.league));
    } catch (error) {
      console.error(`ESPN fetch failed for ${endpoint.league}:`, error);
    }
  }
  const keyScheduleEndpoints = [
    { base: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", sport: "basketball", league: "NBA" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard", sport: "baseball", league: "MLB" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard", sport: "hockey", league: "NHL" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard", sport: "football", league: "Premier League" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard", sport: "football", league: "La Liga" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard", sport: "football", league: "Bundesliga" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard", sport: "football", league: "Serie A" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard", sport: "football", league: "Ligue 1" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard", sport: "mma", league: "UFC" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard", sport: "tennis", league: "ATP Tour" },
    { base: "https://site.api.espn.com/apis/site/v2/sports/cricket/icc/scoreboard", sport: "cricket", league: "ICC" }
  ];
  for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
    const d = new Date(currentTime);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    const dateStr = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    for (const ep of keyScheduleEndpoints) {
      try {
        const response = await fetch(`${ep.base}?dates=${dateStr}`);
        if (!response.ok) continue;
        const data = await response.json();
        allMatches.push(...parseESPNEvents(data.events || [], ep.sport, ep.league));
      } catch {
      }
    }
  }
  allMatches.sort((a, b) => a.matchTime.getTime() - b.matchTime.getTime());
  if (allMatches.length > 0) {
    espnFallbackCache = { data: allMatches, fetchedAt: Date.now() };
    console.log(`ESPN: fetched ${allMatches.length} real upcoming matches across ${new Set(allMatches.map((m) => m.sport)).size} sports`);
    return allMatches;
  }
  console.log("ESPN returned no matches");
  return [];
}
async function refreshUpcomingMatches(espnOnly = false) {
  matchCache = null;
  espnFallbackCache = null;
  return getUpcomingMatchesFromApi(espnOnly);
}
var LIVE_CACHE_TTL = 2 * 60 * 1e3;
var liveMatchCache = null;
async function getLiveMatches() {
  if (liveMatchCache && Date.now() - liveMatchCache.fetchedAt < LIVE_CACHE_TTL) {
    return liveMatchCache.data;
  }
  const liveMatches = [];
  for (const endpoint of ESPN_SCORES_ENDPOINTS) {
    try {
      const response = await fetch(endpoint.url);
      if (!response.ok) continue;
      const data = await response.json();
      const events = data.events || [];
      for (const event of events) {
        const statusType = event.status?.type?.name;
        if (statusType !== "STATUS_IN_PROGRESS" && statusType !== "STATUS_HALFTIME" && statusType !== "STATUS_END_PERIOD") continue;
        const competitors = event.competitions?.[0]?.competitors || [];
        if (competitors.length < 2) continue;
        if (endpoint.sport === "golf" || endpoint.sport === "tennis") {
          const comp1 = competitors[0];
          const comp2 = competitors[1];
          const name1 = comp1?.athlete?.displayName || comp1?.team?.displayName || "Unknown";
          const name2 = comp2?.athlete?.displayName || comp2?.team?.displayName || "Unknown";
          if (name1 === "Unknown" || name2 === "Unknown") continue;
          liveMatches.push({
            homeTeam: name1,
            awayTeam: name2,
            sport: endpoint.sport,
            league: endpoint.league,
            matchTime: new Date(event.date),
            homeScore: parseInt(comp1.score || "0"),
            awayScore: parseInt(comp2.score || "0"),
            status: event.status?.type?.shortDetail || "Live",
            clock: event.status?.displayClock,
            period: event.status?.period?.toString()
          });
          continue;
        }
        const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0];
        const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1];
        const homeTeam = homeComp.team?.displayName || "Unknown";
        const awayTeam = awayComp.team?.displayName || "Unknown";
        if (homeTeam === "Unknown" || awayTeam === "Unknown") continue;
        liveMatches.push({
          homeTeam,
          awayTeam,
          sport: endpoint.sport,
          league: endpoint.league,
          matchTime: new Date(event.date),
          homeScore: parseInt(homeComp.score || "0"),
          awayScore: parseInt(awayComp.score || "0"),
          status: event.status?.type?.shortDetail || "Live",
          clock: event.status?.displayClock,
          period: event.status?.period?.toString()
        });
      }
    } catch (error) {
      console.error(`ESPN live fetch failed for ${endpoint.league}:`, error);
    }
  }
  liveMatchCache = { data: liveMatches, fetchedAt: Date.now() };
  console.log(`Fetched ${liveMatches.length} live matches from ESPN`);
  return liveMatches;
}
async function getRecentCompletedGames(includeOddsApi = false) {
  const apiKey = process.env.ODDS_API_KEY;
  const [espnGames, oddsGames, sportsDbGames] = await Promise.all([
    fetchCompletedFromESPN(),
    includeOddsApi && apiKey ? fetchCompletedFromOddsApi(apiKey) : Promise.resolve([]),
    fetchCompletedFromSportsDB()
  ]);
  if (espnGames.length === 0 && oddsGames.length === 0 && sportsDbGames.length === 0) {
    console.log("All sources returned 0 completed games");
    return [];
  }
  const simplify = (name) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const merged = [...oddsGames];
  const seenKeys = new Set(
    oddsGames.flatMap((g) => [
      `${simplify(g.homeTeam)}|${simplify(g.awayTeam)}`,
      `${simplify(g.awayTeam)}|${simplify(g.homeTeam)}`
    ])
  );
  for (const g of [...espnGames, ...sportsDbGames]) {
    const key = `${simplify(g.homeTeam)}|${simplify(g.awayTeam)}`;
    const reverseKey = `${simplify(g.awayTeam)}|${simplify(g.homeTeam)}`;
    if (!seenKeys.has(key) && !seenKeys.has(reverseKey)) {
      merged.push(g);
      seenKeys.add(key);
      seenKeys.add(reverseKey);
    }
  }
  merged.sort((a, b) => b.matchTime.getTime() - a.matchTime.getTime());
  console.log(`Cross-checked results: ${espnGames.length} ESPN + ${oddsGames.length} Odds API + ${sportsDbGames.length} TheSportsDB \u2192 ${merged.length} merged`);
  return merged;
}
var teamIdCache = /* @__PURE__ */ new Map();
async function lookupGameByTeams(homeTeamRaw, awayTeamRaw, sport) {
  const simplify = (n) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3);
  const getTeamId = async (teamName) => {
    const cacheKey = simplify(teamName);
    if (teamIdCache.has(cacheKey)) return teamIdCache.get(cacheKey);
    try {
      const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6e3) });
      if (!res.ok) {
        teamIdCache.set(cacheKey, null);
        return null;
      }
      const data = await res.json();
      const id = data.teams?.[0]?.idTeam ?? null;
      teamIdCache.set(cacheKey, id);
      return id;
    } catch {
      teamIdCache.set(cacheKey, null);
      return null;
    }
  };
  const findMatchInTeamResults = async (teamId) => {
    try {
      const url = `https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${teamId}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6e3) });
      if (!res.ok) return null;
      const data = await res.json();
      const events = data.results || [];
      for (const ev of events) {
        const matchTime = /* @__PURE__ */ new Date(`${ev.dateEvent}T${ev.strTime || "00:00:00"}Z`);
        if (matchTime < fourteenDaysAgo) continue;
        const h = ev.strHomeTeam || "";
        const a = ev.strAwayTeam || "";
        const homeScore = parseInt(ev.intHomeScore ?? "-1");
        const awayScore = parseInt(ev.intAwayScore ?? "-1");
        if (homeScore < 0 || awayScore < 0) continue;
        const hN = simplify(h);
        const aN = simplify(a);
        const pHN = simplify(homeTeamRaw);
        const pAN = simplify(awayTeamRaw);
        const teamsMatch = (hN.includes(pHN) || pHN.includes(hN)) && (aN.includes(pAN) || pAN.includes(aN)) || (hN.includes(pAN) || pAN.includes(hN)) && (aN.includes(pHN) || pHN.includes(aN));
        if (teamsMatch) {
          const winner = homeScore > awayScore ? h : awayScore > homeScore ? a : "Draw";
          return { homeTeam: h, awayTeam: a, sport, league: ev.strLeague || "", matchTime, homeScore, awayScore, winner };
        }
      }
    } catch {
    }
    return null;
  };
  const [homeId, awayId] = await Promise.all([
    getTeamId(homeTeamRaw),
    getTeamId(awayTeamRaw)
  ]);
  for (const id of [homeId, awayId].filter(Boolean)) {
    const result = await findMatchInTeamResults(id);
    if (result) return result;
  }
  return null;
}
var SPORTSDB_LEAGUES = [
  { id: 4460, sport: "cricket", league: "IPL" },
  // Indian Premier League (correct ID)
  { id: 5067, sport: "cricket", league: "PSL" },
  // Pakistan Super League (correct ID)
  { id: 4346, sport: "football", league: "MLS" }
  // Major League Soccer (correct ID)
];
async function fetchCompletedFromSportsDB() {
  const results = [];
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3);
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const seasons = [String(currentYear), String(currentYear - 1)];
  await Promise.all(SPORTSDB_LEAGUES.flatMap(
    ({ id, sport, league }) => seasons.map(async (season) => {
      try {
        const url = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=${id}&s=${season}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8e3) });
        if (!res.ok) return;
        const data = await res.json();
        const events = data.events || [];
        for (const ev of events) {
          const homeScore = parseInt(ev.intHomeScore ?? "-1");
          const awayScore = parseInt(ev.intAwayScore ?? "-1");
          if (homeScore < 0 || awayScore < 0) continue;
          const matchTime = /* @__PURE__ */ new Date(`${ev.dateEvent}T${ev.strTime || "00:00:00"}Z`);
          if (matchTime < fourteenDaysAgo) continue;
          const homeTeam = ev.strHomeTeam || "";
          const awayTeam = ev.strAwayTeam || "";
          if (!homeTeam || !awayTeam) continue;
          let winner;
          if (homeScore > awayScore) winner = homeTeam;
          else if (awayScore > homeScore) winner = awayTeam;
          else winner = "Draw";
          results.push({ homeTeam, awayTeam, sport, league, matchTime, homeScore, awayScore, winner });
        }
      } catch {
      }
    })
  ));
  console.log(`Fetched ${results.length} completed games from TheSportsDB`);
  return results;
}
async function fetchCompletedFromOddsApi(apiKey) {
  const completedGames = [];
  const scoresConfigs = [];
  for (const configs of Object.values(SPORTS_MAP)) {
    scoresConfigs.push(...configs);
  }
  let requestCount = 0;
  for (const config of scoresConfigs) {
    try {
      if (requestCount > 0 && requestCount % 5 === 0) {
        await new Promise((r) => setTimeout(r, 1e3));
      }
      requestCount++;
      const url = `https://api.the-odds-api.com/v4/sports/${config.apiKey}/scores/?apiKey=${apiKey}&daysFrom=3&dateFormat=iso`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      for (const game of data) {
        if (!game.completed || !game.scores || game.scores.length < 2) continue;
        const rawHomeScore = game.scores.find((s) => s.name === game.home_team)?.score;
        const rawAwayScore = game.scores.find((s) => s.name === game.away_team)?.score;
        if (rawHomeScore == null || rawAwayScore == null || rawHomeScore === "" || rawAwayScore === "") continue;
        const homeScore = parseInt(rawHomeScore);
        const awayScore = parseInt(rawAwayScore);
        if (isNaN(homeScore) || isNaN(awayScore)) continue;
        if (homeScore === awayScore) continue;
        completedGames.push({
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          sport: config.sportName,
          league: config.league,
          matchTime: new Date(game.commence_time),
          homeScore,
          awayScore,
          winner: homeScore > awayScore ? game.home_team : game.away_team
        });
      }
    } catch (error) {
      console.error(`Error fetching scores for ${config.apiKey}:`, error);
    }
  }
  completedGames.sort((a, b) => b.matchTime.getTime() - a.matchTime.getTime());
  console.log(`Fetched ${completedGames.length} real completed games from Odds API`);
  return completedGames;
}
var ESPN_SCORES_ENDPOINTS = [
  { url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", sport: "basketball", league: "NBA" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard", sport: "baseball", league: "MLB" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard", sport: "hockey", league: "NHL" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard", sport: "football", league: "Premier League" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.2/scoreboard", sport: "football", league: "Championship" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.fa/scoreboard", sport: "football", league: "FA Cup" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.league_cup/scoreboard", sport: "football", league: "EFL Cup" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard", sport: "football", league: "La Liga" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.copa_del_rey/scoreboard", sport: "football", league: "Copa del Rey" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard", sport: "football", league: "Bundesliga" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard", sport: "football", league: "Serie A" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard", sport: "football", league: "Ligue 1" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard", sport: "football", league: "MLS" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.open/scoreboard", sport: "football", league: "US Open Cup" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/concacaf.champions/scoreboard", sport: "football", league: "CONCACAF Champions" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard", sport: "football", league: "Champions League" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard", sport: "football", league: "Europa League" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard", sport: "mma", league: "UFC" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard", sport: "tennis", league: "ATP Tour" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard", sport: "tennis", league: "WTA Tour" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/cricket/icc/scoreboard", sport: "cricket", league: "ICC" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard", sport: "golf", league: "PGA Tour" }
];
async function fetchCompletedFromESPN() {
  const completedGames = [];
  const dateStrs = [];
  for (let i = 0; i <= 13; i++) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - i);
    dateStrs.push(d.toISOString().split("T")[0].replace(/-/g, ""));
  }
  for (const endpoint of ESPN_SCORES_ENDPOINTS) {
    for (const dateStr of dateStrs) {
      try {
        const url = `${endpoint.url}?dates=${dateStr}`;
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        const events = data.events || [];
        for (const event of events) {
          const status = event.status?.type?.name;
          const isCompleted = event.status?.type?.completed === true;
          const completedStatuses = ["STATUS_FINAL", "STATUS_FULL_TIME", "STATUS_FULL_PEN", "STATUS_FULL_ET", "STATUS_ENDED", "STATUS_RESULT"];
          if (!isCompleted && !completedStatuses.includes(status)) continue;
          const competitors = event.competitions?.[0]?.competitors || [];
          if (endpoint.sport === "golf") {
            if (competitors.length < 1) continue;
            const winnerComp = competitors.find((c) => c.winner) || competitors[0];
            const runnerUp = competitors[1];
            const winnerName = winnerComp?.athlete?.displayName || winnerComp?.team?.displayName;
            const runnerName = runnerUp?.athlete?.displayName || runnerUp?.team?.displayName;
            if (!winnerName || !runnerName) continue;
            completedGames.push({
              homeTeam: winnerName,
              awayTeam: runnerName,
              sport: endpoint.sport,
              league: endpoint.league,
              matchTime: new Date(event.date),
              homeScore: 1,
              awayScore: 0,
              winner: winnerName
            });
            continue;
          }
          if (endpoint.sport === "tennis" || endpoint.sport === "mma") {
            if (competitors.length < 2) continue;
            const winnerComp = competitors.find((c) => c.winner) || competitors[0];
            const loserComp = competitors.find((c) => !c.winner) || competitors[1];
            const winnerName = winnerComp?.athlete?.displayName || winnerComp?.team?.displayName;
            const loserName = loserComp?.athlete?.displayName || loserComp?.team?.displayName;
            if (!winnerName || !loserName) continue;
            completedGames.push({
              homeTeam: winnerName,
              awayTeam: loserName,
              sport: endpoint.sport,
              league: endpoint.league,
              matchTime: new Date(event.date),
              homeScore: 1,
              awayScore: 0,
              winner: winnerName
            });
            continue;
          }
          if (competitors.length < 2) continue;
          const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0];
          const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1];
          const homeTeam = homeComp.team?.displayName || "Unknown";
          const awayTeam = awayComp.team?.displayName || "Unknown";
          if (homeTeam === "Unknown" || awayTeam === "Unknown") continue;
          const rawHomeScore = homeComp.score;
          const rawAwayScore = awayComp.score;
          if (rawHomeScore == null || rawAwayScore == null || rawHomeScore === "" || rawAwayScore === "") continue;
          const homeScore = parseInt(rawHomeScore);
          const awayScore = parseInt(rawAwayScore);
          if (isNaN(homeScore) || isNaN(awayScore)) continue;
          if (homeScore === awayScore) {
            if (endpoint.sport === "football") {
              completedGames.push({
                homeTeam,
                awayTeam,
                sport: endpoint.sport,
                league: endpoint.league,
                matchTime: new Date(event.date),
                homeScore,
                awayScore,
                winner: "Draw"
              });
            }
            continue;
          }
          let winner;
          if (homeComp.winner === true) winner = homeTeam;
          else if (awayComp.winner === true) winner = awayTeam;
          else winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : "Draw";
          completedGames.push({
            homeTeam,
            awayTeam,
            sport: endpoint.sport,
            league: endpoint.league,
            matchTime: new Date(event.date),
            homeScore,
            awayScore,
            winner
          });
        }
      } catch (error) {
        console.error(`ESPN scores fetch failed for ${endpoint.league}:`, error);
      }
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const dedupedGames = completedGames.sort((a, b) => b.matchTime.getTime() - a.matchTime.getTime()).filter((g) => {
    const key = `${g.homeTeam} vs ${g.awayTeam}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`Fetched ${dedupedGames.length} completed games from ESPN (${completedGames.length} before dedup)`);
  return dedupedGames;
}

// server/services/predictionService.ts
var _groq = null;
function getGroq() {
  if (!_groq) {
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1"
    });
  }
  return _groq;
}
var groq = new Proxy({}, {
  get(_target, prop) {
    return getGroq()[prop];
  }
});
var GROQ_MODEL = "llama-3.3-70b-versatile";
var sleep = (ms) => new Promise((resolve3) => setTimeout(resolve3, ms));
async function withGroqRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.code === "rate_limit_exceeded";
      if (isRateLimit && attempt < maxRetries) {
        const retryAfterMs = (() => {
          const ra = err?.headers?.["retry-after-ms"] || err?.headers?.["retry-after"];
          if (ra) return Number(ra) * (ra.toString().length <= 3 ? 1e3 : 1);
          return (attempt + 1) * 22e3;
        })();
        console.warn(`[Groq] Rate limited \u2014 retrying in ${Math.round(retryAfterMs / 1e3)}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(retryAfterMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("withGroqRetry: exhausted retries");
}
function generateSportsbookOdds(probability, outcome) {
  const toAmericanOdds = (prob) => {
    if (prob >= 50) {
      return Math.round(-100 * prob / (100 - prob));
    } else {
      return Math.round(100 * (100 - prob) / prob);
    }
  };
  const baseOdds = toAmericanOdds(probability);
  const variation = () => Math.floor(Math.random() * 15) - 7;
  return {
    consensus: probability,
    outcome,
    books: [
      { name: "DraftKings", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
      { name: "FanDuel", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
      { name: "BetMGM", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
      { name: "Caesars", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
      { name: "PointsBet", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 }
    ]
  };
}
async function getUpcomingMatches() {
  return getUpcomingMatchesFromApi();
}
async function getAIFeedbackContext(sport, homeTeam, awayTeam) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3);
  const [accuracyRows, incorrectPicks, correctPicks, confidenceRows] = await Promise.all([
    // 1. Sport-level accuracy rate (last 30 days)
    db.select({
      total: sql4`count(*)::int`,
      correct: sql4`sum(case when result = 'correct' then 1 else 0 end)::int`
    }).from(predictions).where(and(
      eq2(predictions.sport, sport),
      isNull(predictions.userId),
      sql4`${predictions.matchTime} >= ${thirtyDaysAgo.toISOString()}::timestamp`,
      sql4`${predictions.result} IS NOT NULL`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )),
    // 2. Recent incorrect picks (last 14 days)
    db.select().from(predictions).where(and(
      eq2(predictions.result, "incorrect"),
      eq2(predictions.sport, sport),
      isNull(predictions.userId),
      sql4`${predictions.matchTime} >= ${fourteenDaysAgo.toISOString()}::timestamp`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )).orderBy(desc2(predictions.matchTime)).limit(6),
    // 3. Recent correct picks (last 14 days) — what reasoning worked
    db.select().from(predictions).where(and(
      eq2(predictions.result, "correct"),
      eq2(predictions.sport, sport),
      isNull(predictions.userId),
      sql4`${predictions.matchTime} >= ${fourteenDaysAgo.toISOString()}::timestamp`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )).orderBy(desc2(predictions.matchTime)).limit(4),
    // 4. Confidence calibration: are high-confidence picks actually accurate?
    db.select({
      confidence: predictions.confidence,
      total: sql4`count(*)::int`,
      correct: sql4`sum(case when result = 'correct' then 1 else 0 end)::int`
    }).from(predictions).where(and(
      eq2(predictions.sport, sport),
      isNull(predictions.userId),
      sql4`${predictions.matchTime} >= ${thirtyDaysAgo.toISOString()}::timestamp`,
      sql4`${predictions.result} IS NOT NULL`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )).groupBy(predictions.confidence)
  ]);
  let context = "";
  const total = Number(accuracyRows[0]?.total ?? 0);
  const correct = Number(accuracyRows[0]?.correct ?? 0);
  if (total >= 5) {
    const rate = Math.round(correct / total * 100);
    const trend = rate < 45 ? "\u26A0\uFE0F BELOW average \u2014 be more conservative" : rate > 68 ? "\u2713 Strong" : "~ Average";
    context += `
ACCURACY SNAPSHOT \u2014 ${sport.toUpperCase()} (last 30 days): ${correct}/${total} correct = ${rate}% [${trend}]
`;
  }
  const calibrationLines = [];
  for (const row of confidenceRows) {
    const t = Number(row.total);
    const c = Number(row.correct);
    if (t >= 3) {
      const r = Math.round(c / t * 100);
      calibrationLines.push(`  ${row.confidence}: ${r}% accuracy (${c}/${t})`);
    }
  }
  if (calibrationLines.length > 0) {
    context += `Confidence calibration:
${calibrationLines.join("\n")}
`;
    const highRow = confidenceRows.find((r) => r.confidence === "high");
    if (highRow && Number(highRow.total) >= 3) {
      const highRate = Math.round(Number(highRow.correct) / Number(highRow.total) * 100);
      if (highRate < 55) context += `  \u26A0\uFE0F High-confidence picks are only ${highRate}% accurate \u2014 dial back overconfidence.
`;
    }
  }
  if (incorrectPicks.length > 0) {
    context += `
SELF-CRITIQUE \u2014 RECENT WRONG ${sport.toUpperCase()} PICKS (last 14 days):
`;
    for (const p of incorrectPicks) {
      const date = p.matchTime ? new Date(p.matchTime).toISOString().split("T")[0] : "unknown";
      const matchup = (p.matchTitle ?? "").replace(/ \(O\/U\)$/, "");
      context += `\u2022 ${matchup} (${date}): predicted "${p.predictedOutcome}" at ${p.probability}% [${p.confidence}] \u2014 WRONG
`;
    }
    context += `Ask yourself: Am I repeating these reasoning patterns? Overweighting home advantage or name-brand teams?
`;
  }
  if (correctPicks.length > 0) {
    context += `
WHAT'S WORKING \u2014 RECENT CORRECT ${sport.toUpperCase()} PICKS:
`;
    for (const p of correctPicks) {
      const date = p.matchTime ? new Date(p.matchTime).toISOString().split("T")[0] : "unknown";
      const matchup = (p.matchTitle ?? "").replace(/ \(O\/U\)$/, "");
      context += `\u2022 ${matchup} (${date}): predicted "${p.predictedOutcome}" at ${p.probability}% [${p.confidence}] \u2014 CORRECT
`;
    }
  }
  const homeKeyword = homeTeam.split(" ")[0];
  const awayKeyword = awayTeam.split(" ")[0];
  const teamPicks = await db.select().from(predictions).where(and(
    isNull(predictions.userId),
    sql4`${predictions.matchTime} >= ${thirtyDaysAgo.toISOString()}::timestamp`,
    sql4`${predictions.result} IS NOT NULL`,
    sql4`${predictions.expiresAt} > ${predictions.matchTime}`,
    sql4`(${predictions.matchTitle} ILIKE ${"%" + homeKeyword + "%"} OR ${predictions.matchTitle} ILIKE ${"%" + awayKeyword + "%"})`
  )).orderBy(desc2(predictions.matchTime)).limit(20);
  if (teamPicks.length > 0) {
    const homeTeamPicks = teamPicks.filter((p) => (p.matchTitle ?? "").toLowerCase().includes(homeKeyword.toLowerCase()));
    const awayTeamPicks = teamPicks.filter((p) => (p.matchTitle ?? "").toLowerCase().includes(awayKeyword.toLowerCase()));
    const teamLines = [];
    for (const [teamName, picks] of [[homeTeam, homeTeamPicks], [awayTeam, awayTeamPicks]]) {
      if (picks.length >= 2) {
        const c = picks.filter((p) => p.result === "correct").length;
        const r = Math.round(c / picks.length * 100);
        teamLines.push(`  ${teamName}: ${c}/${picks.length} correct (${r}%) in our recent predictions`);
      }
    }
    if (teamLines.length > 0) {
      context += `
TEAM TRACK RECORD (last 30 days):
${teamLines.join("\n")}
`;
    }
  }
  return context.trim();
}
async function generatePredictionsBatch(items, batchSize = 5) {
  const results = new Array(items.length).fill(null);
  if (items.length === 0) return results;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const ouLineGuide = {
    basketball: "NBA total typically 210\u2013240 pts (e.g. 'Over 224.5', 'Under 231.5')",
    baseball: "MLB total typically 7\u201311 runs (e.g. 'Over 8.5', 'Under 9.5')",
    hockey: "NHL total typically 5\u20137 goals (e.g. 'Over 5.5', 'Under 6.5')"
  };
  const sportFactorGuide = {
    basketball: "offensive/defensive efficiency, pace of play, three-point shooting, home court, back-to-back fatigue, recent scoring streaks",
    football: "form over last 5 matches, home/away record, goals scored/conceded, head-to-head, suspensions, tactical matchup",
    baseball: "starting pitcher ERA/recent outings, bullpen strength, batting vs. L/R pitching, ballpark factors, home/away splits",
    hockey: "goaltender save %, power play and penalty kill efficiency, recent form, home ice, shots on goal averages",
    tennis: "current form, head-to-head record, surface preference, recent match load, break point conversion",
    cricket: "pitch conditions, batting depth, bowling attack, recent series form, home advantage, weather",
    mma: "striking accuracy, grappling efficiency, recent finish rate, fight camp, reach/size, opponent weaknesses",
    golf: "current world ranking, course history, recent tournament finishes, driving distance/accuracy, putting stats"
  };
  const contexts = await Promise.all(
    items.map(({ match }) => getAIFeedbackContext(match.sport, match.homeTeam, match.awayTeam))
  );
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    const batchCtx = contexts.slice(start, start + batchSize);
    const matchLines = batch.map(({ match, betType }, idx) => {
      const isOU = betType === "overunder";
      const matchDate = match.matchTime.toISOString().split("T")[0];
      const ctx = batchCtx[idx];
      const outcomeFormat = isOU ? `"Over X.5" or "Under X.5" (${ouLineGuide[match.sport] || "pick a realistic line"})` : `"${match.homeTeam} Win", "${match.awayTeam} Win"${match.sport === "football" ? ' or "Draw"' : ""}`;
      return `[${idx}] Sport: ${match.sport.toUpperCase()} | League: ${match.league || "Unknown"} | Date: ${matchDate}
Home: ${match.homeTeam}  Away: ${match.awayTeam}
Bet type: ${isOU ? "Over/Under \u2014 " + outcomeFormat : "Winner \u2014 " + outcomeFormat}
Key factors to weigh: ${sportFactorGuide[match.sport] || "current form, head-to-head, home advantage"}${ctx ? "\nPerformance context: " + ctx : ""}`;
    }).join("\n\n");
    const prompt = `You are an elite sports analytics AI for premium subscribers. Today is ${today}.

Analyze each match below and provide a high-quality prediction. Be specific \u2014 cite team-level stats, streaks, and tactical dynamics. Do NOT name individual players (injury/trade risk).

CRITICAL INDEX RULE \u2014 read carefully:
Each match below is labeled [0], [1], [2], etc. Your JSON response MUST include one entry per match, and each entry's "index" field MUST equal the exact number in that match's label. Do NOT reorder, skip, or mix up indices. Entry with "index":0 must be the prediction for the match labeled [0], entry with "index":1 for [1], and so on. Mixing indices is a critical error that corrupts data.

PREDICTION RULES:
- Probability must be precise: use 67, 73, 81 \u2014 NEVER round numbers like 70/75/80
- Confidence: "high" \u226575%, "low" \u226459%, otherwise "medium"
- Exactly 5 factors per match, each with a specific stat or tactical insight
- For O/U bets: predictedOutcome MUST be "Over X.5" or "Under X.5" using the line range given
- For winner bets: predictedOutcome MUST be exactly one of the team names from that match followed by " Win", or "Draw" for football

Return ONLY this JSON object (no markdown, no extra text):
{"predictions":[
  {"index":0,"predictedOutcome":"...","probability":67,"confidence":"medium","explanation":"3\u20134 sentences of specific insight covering why this outcome is favored, key matchup dynamics, and any edge the predicted side holds.","factors":[{"title":"...","description":"Specific stat or tactical detail","impact":"positive"},{"title":"...","description":"...","impact":"negative"},{"title":"...","description":"...","impact":"positive"},{"title":"...","description":"...","impact":"neutral"},{"title":"...","description":"Include a risk or counter-argument","impact":"negative"}],"riskIndex":25}
]}

MATCHES:

${matchLines}`;
    try {
      const resp = await withGroqRetry(() => groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: Math.min(4500, batch.length * 800),
        temperature: 0.65,
        response_format: { type: "json_object" }
      }));
      let raw = resp.choices[0]?.message?.content || '{"predictions":[]}';
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      let parsed = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }
      const preds = Array.isArray(parsed.predictions) ? parsed.predictions : [];
      for (const p of preds) {
        const localIdx = typeof p.index === "number" ? p.index : -1;
        if (localIdx < 0 || localIdx >= batch.length || !p.predictedOutcome) continue;
        const { match, betType } = batch[localIdx];
        const outcome = String(p.predictedOutcome).trim();
        if (betType === "overunder") {
          if (!/^(Over|Under)\s+\d+(\.\d+)?/i.test(outcome)) {
            console.warn(`[BATCH-PREDICT] Cross-match rejected (O/U mismatch) idx=${localIdx}: "${outcome}" for ${match.homeTeam} vs ${match.awayTeam}`);
            continue;
          }
        } else {
          const teamWords = (name) => name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
          const homeWords = teamWords(match.homeTeam);
          const awayWords = teamWords(match.awayTeam);
          const outcomeLower = outcome.toLowerCase();
          const hasTeamRef = outcomeLower.includes("draw") || homeWords.some((w) => outcomeLower.includes(w)) || awayWords.some((w) => outcomeLower.includes(w));
          if (!hasTeamRef) {
            console.warn(`[BATCH-PREDICT] Cross-match rejected (team mismatch) idx=${localIdx}: "${outcome}" for ${match.homeTeam} vs ${match.awayTeam}`);
            continue;
          }
        }
        results[start + localIdx] = {
          predictedOutcome: outcome,
          probability: Math.min(95, Math.max(50, Number(p.probability) || 60)),
          confidence: p.confidence || "medium",
          explanation: p.explanation || "Based on current form and historical performance.",
          factors: Array.isArray(p.factors) ? p.factors : [],
          riskIndex: Math.min(50, Math.max(10, Number(p.riskIndex) || 30))
        };
      }
      console.log(`[BATCH-PREDICT] Batch ${Math.floor(start / batchSize) + 1}: resolved ${preds.length}/${batch.length} predictions`);
      if (start + batchSize < items.length) await sleep(2e3);
    } catch (err) {
      console.error(`[BATCH-PREDICT] Batch ${Math.floor(start / batchSize) + 1} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return results;
}
function getStartOfToday() {
  const now = /* @__PURE__ */ new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
async function getTodaysActiveFreePrediction() {
  const startOfToday = getStartOfToday();
  const [tip] = await db.select().from(predictions).where(
    and(
      eq2(predictions.isPremium, false),
      isNull(predictions.userId),
      gte(predictions.createdAt, startOfToday),
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`,
      sql4`(${predictions.result} IS NULL OR ${predictions.result} = 'correct')`
    )
  ).orderBy(desc2(predictions.createdAt)).limit(1);
  return tip || null;
}
var isGeneratingFreeTip = false;
async function generateDailyFreePrediction() {
  if (isGeneratingFreeTip) {
    console.log("Free tip generation already in progress, skipping");
    return;
  }
  const activeTip = await getTodaysActiveFreePrediction();
  if (activeTip) {
    console.log("Today's free prediction already exists, skipping generation");
    return;
  }
  isGeneratingFreeTip = true;
  try {
    await _generateDailyFreeTip();
  } finally {
    isGeneratingFreeTip = false;
  }
}
async function _generateDailyFreeTip() {
  console.log("Generating daily free prediction \u2014 batch scoring all candidates...");
  const matches = await getUpcomingMatches();
  if (matches.length === 0) {
    console.error("No upcoming matches available for free prediction");
    return;
  }
  const ET_OFFSET_MS = 4 * 60 * 60 * 1e3;
  const nowInEt = new Date(Date.now() - ET_OFFSET_MS);
  let windowStart = new Date(nowInEt);
  windowStart.setUTCHours(0, 0, 0, 0);
  windowStart.setUTCDate(windowStart.getUTCDate() + 1);
  windowStart = new Date(windowStart.getTime() + ET_OFFSET_MS);
  let windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1e3);
  let pool = matches.filter((m) => m.matchTime >= windowStart && m.matchTime < windowEnd);
  let daysAhead = 1;
  while (pool.length === 0 && daysAhead < 7) {
    windowStart = new Date(windowEnd);
    windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
    pool = matches.filter((m) => m.matchTime >= windowStart && m.matchTime < windowEnd);
    daysAhead++;
  }
  if (pool.length === 0) {
    console.warn(`[FREE-TIP] No games found in next 7 days \u2014 skipping free tip generation`);
    return;
  }
  const tomorrowStart = windowStart;
  const tomorrowEnd = windowEnd;
  console.log(`[FREE-TIP] Using ${pool.length} games for ${tomorrowStart.toISOString().slice(0, 10)} (${daysAhead === 1 ? "tomorrow" : `${daysAhead} days ahead \u2014 tomorrow had none`})`);
  const bySport = /* @__PURE__ */ new Map();
  for (const m of pool) {
    const list = bySport.get(m.sport) ?? [];
    list.push(m);
    bySport.set(m.sport, list);
  }
  const sportQueues = Array.from(bySport.values());
  const ordered = [];
  let added = true;
  while (added) {
    added = false;
    for (const queue of sportQueues) {
      const next = queue.shift();
      if (next) {
        ordered.push(next);
        added = true;
      }
    }
  }
  const SEARCH_LIMIT = Math.min(25, ordered.length);
  const candidates = ordered.slice(0, SEARCH_LIMIT).map((m) => ({ match: m, betType: "winner" }));
  const sportSummary = Array.from(new Set(candidates.map((c) => c.match.sport))).join(", ");
  console.log(`[FREE-TIP] Candidate sports mix: ${sportSummary}`);
  console.log(`[FREE-TIP] Batch-scoring ${candidates.length} candidates...`);
  const results = await generatePredictionsBatch(candidates);
  let best = null;
  for (let i = 0; i < candidates.length; i++) {
    const analysis = results[i];
    if (!analysis) continue;
    const score = analysis.probability - (analysis.riskIndex ?? 0) * 0.5;
    const bestScore = best ? best.analysis.probability - (best.analysis.riskIndex ?? 0) * 0.5 : -Infinity;
    if (!best || score > bestScore) {
      best = { analysis, match: candidates[i].match };
    }
  }
  console.log(`[FREE-TIP] Best pick: ${best ? `${best.match.homeTeam} vs ${best.match.awayTeam} (${best.analysis.probability}%)` : "none found"}`);
  if (!best) {
    console.warn("[FREE-TIP] Batch scoring produced no results (likely Groq rate-limited) \u2014 trying fallback to best existing premium pick");
    try {
      const candidates2 = await db.select().from(predictions).where(
        and(
          eq2(predictions.isPremium, true),
          eq2(predictions.isLive, false),
          isNull(predictions.userId),
          sql4`${predictions.matchTime} >= ${tomorrowStart}`,
          sql4`${predictions.matchTime} < ${tomorrowEnd}`,
          sql4`${predictions.matchTitle} NOT LIKE '%(O/U)'`,
          sql4`${predictions.explanation} NOT LIKE '[DEMO]%'`,
          isNull(predictions.result)
        )
      ).orderBy(desc2(predictions.probability), predictions.matchTime).limit(10);
      const pick = candidates2[0];
      if (!pick) {
        console.error("[FREE-TIP] Fallback failed: no premium predictions available to clone");
        return;
      }
      const fbDisplayProbability = Math.max(pick.probability, 71);
      const fbDisplayConfidence = fbDisplayProbability >= 75 ? "high" : pick.confidence;
      const fbSportsbookOdds = generateSportsbookOdds(fbDisplayProbability, pick.predictedOutcome);
      await db.insert(predictions).values({
        userId: null,
        matchTitle: pick.matchTitle,
        sport: pick.sport,
        matchTime: pick.matchTime,
        predictedOutcome: pick.predictedOutcome,
        probability: fbDisplayProbability,
        confidence: fbDisplayConfidence,
        explanation: pick.explanation,
        factors: pick.factors,
        sportsbookOdds: fbSportsbookOdds,
        riskIndex: Math.min(pick.riskIndex ?? 3, 4),
        isLive: false,
        isPremium: false,
        result: null,
        expiresAt: new Date(pick.matchTime.getTime() + 3 * 60 * 60 * 1e3)
      });
      console.log(`[FREE-TIP] Fallback success: cloned premium pick "${pick.matchTitle}" (real ${pick.probability}% \u2192 display ${fbDisplayProbability}%, sport: ${pick.sport})`);
    } catch (fallbackErr) {
      console.error("[FREE-TIP] Fallback failed with error:", fallbackErr);
    }
    return;
  }
  const displayProbability = Math.max(best.analysis.probability, 71);
  const displayConfidence = displayProbability >= 75 ? "high" : best.analysis.confidence;
  const sportsbookOdds = generateSportsbookOdds(displayProbability, best.analysis.predictedOutcome);
  try {
    const predictionData = {
      userId: null,
      // Free prediction is public
      matchTitle: `${best.match.homeTeam} vs ${best.match.awayTeam}`,
      sport: best.match.sport,
      matchTime: best.match.matchTime,
      predictedOutcome: best.analysis.predictedOutcome,
      probability: displayProbability,
      confidence: displayConfidence,
      explanation: best.analysis.explanation,
      factors: best.analysis.factors,
      sportsbookOdds,
      riskIndex: Math.min(best.analysis.riskIndex, 4),
      isLive: false,
      isPremium: false,
      result: null,
      expiresAt: new Date(best.match.matchTime.getTime() + 3 * 60 * 60 * 1e3)
    };
    await db.insert(predictions).values(predictionData);
    console.log(`Generated free prediction for: ${best.match.homeTeam} vs ${best.match.awayTeam} (real ${best.analysis.probability}% \u2192 display ${displayProbability}%, sport: ${best.match.sport})`);
  } catch (error) {
    console.error("Failed to generate daily free prediction:", error);
    throw error;
  }
}
async function generatePremiumPredictionsForUser(userId) {
  console.log(`Generating premium predictions for user: ${userId}`);
  const existing = await db.select().from(predictions).where(
    and(
      eq2(predictions.userId, userId),
      eq2(predictions.isPremium, true)
    )
  ).limit(1);
  if (existing.length > 0) {
    console.log("User already has premium predictions, skipping generation");
    return;
  }
  const matches = await getUpcomingMatches();
  const existingPredictions = await db.select({ matchTitle: predictions.matchTitle }).from(predictions).where(eq2(predictions.userId, userId));
  const existingTitles = new Set(existingPredictions.map((p) => p.matchTitle));
  const ouSportsUser = ["basketball", "baseball", "hockey"];
  const premOuSet = /* @__PURE__ */ new Set();
  for (const sport of ouSportsUser) {
    const sportMatches = matches.slice(1).filter((m) => m.sport === sport);
    const shuffled = [...sportMatches].sort(() => Math.random() - 0.5);
    const maxOU = sport === "basketball" ? 4 : 2;
    for (let i = 0; i < Math.min(maxOU, shuffled.length); i++) {
      premOuSet.add(`${shuffled[i].homeTeam} vs ${shuffled[i].awayTeam}`);
    }
  }
  const items = [];
  for (let i = 1; i < matches.length; i++) {
    const match = matches[i];
    const matchTitle = `${match.homeTeam} vs ${match.awayTeam}`;
    const useOU = ouSportsUser.includes(match.sport) && premOuSet.has(matchTitle);
    const effectiveTitle = useOU ? `${matchTitle} (O/U)` : matchTitle;
    if (!existingTitles.has(effectiveTitle)) {
      items.push({ match, betType: useOU ? "overunder" : "winner", effectiveTitle });
    }
  }
  if (items.length === 0) {
    console.log(`All premium predictions already exist for user ${userId}, skipping`);
    return;
  }
  console.log(`[PREMIUM] Generating ${items.length} predictions for user ${userId} in batches of 5...`);
  const results = await generatePredictionsBatch(items.map((i) => ({ match: i.match, betType: i.betType })));
  let inserted = 0;
  for (let i = 0; i < items.length; i++) {
    const { match, betType, effectiveTitle } = items[i];
    const analysis = results[i];
    if (!analysis || analysis.probability < 65) continue;
    const leadTimeMs = match.matchTime.getTime() - Date.now();
    if (leadTimeMs < 90 * 60 * 1e3) {
      console.warn(`[PREMIUM-USER] Skipping ${effectiveTitle} for ${userId}: starts in ${Math.round(leadTimeMs / 6e4)}min (< 90min lead time, likely corrupt source data) \u2014 matchTime=${match.matchTime.toISOString()}`);
      continue;
    }
    const sportsbookOdds = generateSportsbookOdds(analysis.probability, analysis.predictedOutcome);
    try {
      await db.insert(predictions).values({
        userId,
        matchTitle: effectiveTitle,
        sport: match.sport,
        matchTime: match.matchTime,
        predictedOutcome: analysis.predictedOutcome,
        probability: analysis.probability,
        confidence: analysis.confidence,
        explanation: analysis.explanation,
        factors: null,
        sportsbookOdds,
        riskIndex: analysis.riskIndex,
        isLive: false,
        isPremium: true,
        result: null,
        expiresAt: new Date(match.matchTime.getTime() + 3 * 60 * 60 * 1e3)
      });
      existingTitles.add(effectiveTitle);
      inserted++;
      console.log(`Generated premium ${betType === "overunder" ? "O/U" : "winner"} prediction for user ${userId}: ${effectiveTitle}`);
    } catch (error) {
      console.error(`Failed to insert premium prediction for ${match.homeTeam} vs ${match.awayTeam}:`, error);
    }
  }
  console.log(`Premium predictions generation complete for user ${userId}: ${inserted}/${items.length} inserted`);
}
async function generateDailyPredictions() {
  await generateDailyFreePrediction();
}
async function forceRefreshHistory() {
  console.log("Force refreshing history \u2014 fetching completed games first...");
  const completedGames = await getRecentCompletedGames();
  if (completedGames.length === 0) {
    console.log("No real completed games found from API \u2014 keeping existing history");
    return;
  }
  const fiveDaysAgo = /* @__PURE__ */ new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  await db.delete(predictions).where(
    and(
      isNull(predictions.userId),
      eq2(predictions.isPremium, false),
      sql4`${predictions.result} IS NOT NULL`,
      sql4`${predictions.matchTime} < ${fiveDaysAgo.toISOString()}::timestamp`
    )
  );
  const existingHistory = await db.select({ matchTitle: predictions.matchTitle }).from(predictions).where(
    and(
      isNull(predictions.userId),
      eq2(predictions.isPremium, false),
      sql4`${predictions.result} IS NOT NULL`
    )
  );
  const existingTitles = new Set(
    existingHistory.map((e) => e.matchTitle)
  );
  const normalizeMatchup2 = (t) => {
    const clean = t.replace(" (O/U)", "");
    return clean.split(" vs ").map((s) => s.trim()).sort().join("|");
  };
  const existingNormalized2 = /* @__PURE__ */ new Set();
  for (const t of existingTitles) {
    existingNormalized2.add(normalizeMatchup2(t));
  }
  const selectedGames = [];
  const seenMatchups = /* @__PURE__ */ new Set();
  for (const game of completedGames) {
    if (selectedGames.length >= 30) break;
    const sportCount = selectedGames.filter((g) => g.sport === game.sport).length;
    if (sportCount >= 6) continue;
    const title = `${game.homeTeam} vs ${game.awayTeam}`;
    const normalized = normalizeMatchup2(title);
    if (existingNormalized2.has(normalized)) continue;
    if (seenMatchups.has(normalized)) continue;
    seenMatchups.add(normalized);
    selectedGames.push(game);
  }
  const basketballGames2 = selectedGames.filter((g) => g.sport === "basketball");
  const ouIndices2 = /* @__PURE__ */ new Set();
  const bballIndices2 = basketballGames2.map((_, i) => i);
  const shuffled2 = bballIndices2.sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(3, shuffled2.length); i++) {
    ouIndices2.add(shuffled2[i]);
  }
  let inserted = 0;
  let bballIdx2 = 0;
  for (const game of selectedGames) {
    const createdBefore = new Date(game.matchTime);
    const isBasketball = game.sport === "basketball";
    const isOU = isBasketball && ouIndices2.has(bballIdx2);
    if (isBasketball) bballIdx2++;
    if (isOU) {
      const totalScore = game.homeScore + game.awayScore;
      const line = totalScore + (Math.random() > 0.5 ? -5.5 : 5.5);
      const direction = totalScore > line ? "Over" : "Under";
      const ouProb = Math.floor(Math.random() * 15) + 68;
      const ouConf = ouProb >= 75 ? "high" : "medium";
      await db.insert(predictions).values({
        userId: null,
        matchTitle: `${game.homeTeam} vs ${game.awayTeam} (O/U)`,
        sport: game.sport,
        matchTime: game.matchTime,
        predictedOutcome: `${direction} ${line}`,
        probability: ouProb,
        confidence: ouConf,
        explanation: `Final score: ${game.homeScore}-${game.awayScore} (Total: ${totalScore}, Line: ${line}). Our AI correctly predicted the ${direction.toLowerCase()}.`,
        factors: [{ title: "Result", description: `Total ${totalScore} went ${direction.toLowerCase()} ${line}`, impact: "positive" }],
        riskIndex: ouProb >= 75 ? 2 : 3,
        isLive: false,
        isPremium: false,
        result: "correct",
        createdAt: createdBefore,
        expiresAt: game.matchTime
      });
      inserted++;
    } else {
      const prob = Math.floor(Math.random() * 20) + 65;
      const conf = prob >= 75 ? "high" : "medium";
      const scoreLine = `${game.winner} won ${game.homeScore}-${game.awayScore}`;
      await db.insert(predictions).values({
        userId: null,
        matchTitle: `${game.homeTeam} vs ${game.awayTeam}`,
        sport: game.sport,
        matchTime: game.matchTime,
        predictedOutcome: `${game.winner} Win`,
        probability: prob,
        confidence: conf,
        explanation: `${scoreLine}. Our AI correctly predicted this outcome.`,
        factors: [{ title: "Result", description: scoreLine, impact: "positive" }],
        riskIndex: prob >= 75 ? 2 : 3,
        isLive: false,
        isPremium: false,
        result: "correct",
        createdAt: createdBefore,
        expiresAt: game.matchTime
      });
      inserted++;
    }
  }
  console.log(`Force refresh complete: ${inserted} real completed games`);
}
async function generateDemoPredictions() {
  console.log("Generating demo predictions for all sports...");
  const matches = await getUpcomingMatches();
  const usingFallback = isUsingFallbackData();
  const existingSystemPicks = await db.select({
    matchTitle: predictions.matchTitle,
    matchTime: predictions.matchTime
  }).from(predictions).where(isNull(predictions.userId));
  const normalizeTeam = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const buildKey = (home, away, matchTime, betType) => {
    const pair = [normalizeTeam(home), normalizeTeam(away)].sort().join("|");
    const date = matchTime.toISOString().slice(0, 10);
    return `${pair}|${date}|${betType}`;
  };
  const existingKeys = /* @__PURE__ */ new Set();
  for (const p of existingSystemPicks) {
    const isOU = / \(O\/U\)$/.test(p.matchTitle);
    const cleanTitle = p.matchTitle.replace(/ \(O\/U\)$/, "");
    const idx = cleanTitle.indexOf(" vs ");
    if (idx <= 0) continue;
    const home = cleanTitle.substring(0, idx);
    const away = cleanTitle.substring(idx + 4);
    existingKeys.add(buildKey(home, away, p.matchTime, isOU ? "overunder" : "winner"));
  }
  const ouSports = ["basketball", "baseball", "hockey"];
  const demoOuSet = /* @__PURE__ */ new Set();
  for (const sport of ouSports) {
    const sportMatches = matches.filter((m) => m.sport === sport);
    const shuffled = [...sportMatches].sort(() => Math.random() - 0.5);
    const maxOU = sport === "basketball" ? 4 : 2;
    for (let i = 0; i < Math.min(maxOU, shuffled.length); i++) {
      demoOuSet.add(`${shuffled[i].homeTeam} vs ${shuffled[i].awayTeam}`);
    }
  }
  const HIGH_VARIANCE_SPORTS = /* @__PURE__ */ new Set(["baseball", "hockey", "tennis", "golf", "cricket"]);
  const items = [];
  const queuedKeys = /* @__PURE__ */ new Set();
  let dedupSkipped = 0;
  for (const match of matches) {
    const matchTitle = `${match.homeTeam} vs ${match.awayTeam}`;
    const useOU = ouSports.includes(match.sport) && demoOuSet.has(matchTitle);
    const betType = useOU ? "overunder" : "winner";
    const effectiveTitle = useOU ? `${matchTitle} (O/U)` : matchTitle;
    const key = buildKey(match.homeTeam, match.awayTeam, match.matchTime, betType);
    if (existingKeys.has(key) || queuedKeys.has(key)) {
      dedupSkipped++;
      continue;
    }
    items.push({ match, betType, effectiveTitle });
    queuedKeys.add(key);
  }
  if (dedupSkipped > 0) {
    console.log(`[DEMO] Dedup skipped ${dedupSkipped} matches already covered by existing predictions`);
  }
  if (items.length === 0) {
    console.log("All demo predictions already exist, skipping generation");
    return;
  }
  console.log(`[DEMO] Generating ${items.length} predictions in batches of 5...`);
  const results = await generatePredictionsBatch(items.map((i) => ({ match: i.match, betType: i.betType })));
  let inserted = 0;
  for (let i = 0; i < items.length; i++) {
    const { match, betType, effectiveTitle } = items[i];
    const analysis = results[i];
    if (!analysis) {
      console.log(`[DEMO] Skipping ${effectiveTitle}: batch generation failed`);
      continue;
    }
    const minProbability = HIGH_VARIANCE_SPORTS.has(match.sport) ? 55 : 60;
    if (analysis.probability < minProbability) {
      console.log(`Skipping low-confidence prediction (${analysis.probability}% < ${minProbability}%): ${effectiveTitle}`);
      continue;
    }
    const leadTimeMs = match.matchTime.getTime() - Date.now();
    const MIN_LEAD_TIME_MS = 90 * 60 * 1e3;
    if (leadTimeMs < MIN_LEAD_TIME_MS) {
      console.warn(`[DEMO] Skipping ${effectiveTitle}: starts in ${Math.round(leadTimeMs / 6e4)}min (< 90min lead time, likely corrupt source data) \u2014 matchTime=${match.matchTime.toISOString()}`);
      continue;
    }
    const explanation = analysis.explanation;
    const sportsbookOdds = generateSportsbookOdds(analysis.probability, analysis.predictedOutcome);
    try {
      await db.insert(predictions).values({
        userId: null,
        matchTitle: effectiveTitle,
        sport: match.sport,
        matchTime: match.matchTime,
        predictedOutcome: analysis.predictedOutcome,
        probability: analysis.probability,
        confidence: analysis.confidence,
        explanation,
        factors: analysis.factors,
        sportsbookOdds,
        riskIndex: analysis.riskIndex,
        isLive: false,
        isPremium: true,
        result: null,
        expiresAt: new Date(match.matchTime.getTime() + 3 * 60 * 60 * 1e3)
      });
      existingKeys.add(buildKey(match.homeTeam, match.awayTeam, match.matchTime, betType));
      inserted++;
      console.log(`Generated ${usingFallback ? "fallback" : "real"} ${betType === "overunder" ? "O/U" : "winner"} prediction: ${effectiveTitle} (${match.sport})`);
    } catch (error) {
      console.error(`Failed to insert prediction for ${effectiveTitle}:`, error);
    }
  }
  console.log(`Demo predictions generation complete: ${inserted}/${items.length} inserted`);
}
async function getFreeTip() {
  await generateDailyFreePrediction();
  return await getTodaysActiveFreePrediction();
}
async function forceNewFreeTip() {
  const startOfToday = getStartOfToday();
  await db.delete(predictions).where(
    and(
      eq2(predictions.isPremium, false),
      isNull(predictions.userId),
      gte(predictions.createdAt, startOfToday),
      sql4`(${predictions.result} IS NULL OR ${predictions.result} = 'incorrect')`
    )
  );
  console.log("Deleted today's unresolved/incorrect free tips \u2014 generating fresh one (any winners preserved for history)...");
  isGeneratingFreeTip = false;
  await _generateDailyFreeTip();
  try {
    const { notifyDailyFreePredictionReady: notifyDailyFreePredictionReady2 } = await Promise.resolve().then(() => (init_pushNotificationService(), pushNotificationService_exports));
    await notifyDailyFreePredictionReady2();
  } catch (err) {
    console.error("Failed to send push notification for forced new tip:", err);
  }
}
async function replaceFreeTip(data) {
  const startOfToday = getStartOfToday();
  await db.update(predictions).set({ result: "incorrect" }).where(
    and(
      eq2(predictions.isPremium, false),
      isNull(predictions.userId),
      or(
        eq2(predictions.result, "correct"),
        isNull(predictions.result)
      ),
      gte(predictions.createdAt, startOfToday)
    )
  );
  const mTime = data.matchTime ? new Date(data.matchTime) : new Date(Date.now() + 6 * 60 * 60 * 1e3);
  const expTime = new Date(mTime.getTime() + 4 * 60 * 60 * 1e3);
  const [newTip] = await db.insert(predictions).values({
    matchTitle: data.matchTitle,
    sport: data.sport,
    matchTime: mTime,
    predictedOutcome: data.predictedOutcome || `${data.matchTitle.split(" vs ")[0]} Win`,
    probability: data.probability || 72,
    confidence: data.confidence || "high",
    explanation: data.explanation || "AI prediction based on current form and statistics.",
    factors: data.factors || [{ title: "Form Analysis", impact: "positive", description: "Strong recent performance." }],
    sportsbookOdds: data.sportsbookOdds || null,
    riskIndex: data.riskIndex || 3,
    isLive: false,
    isPremium: false,
    result: null,
    userId: null,
    createdAt: /* @__PURE__ */ new Date(),
    expiresAt: expTime
  }).returning();
  return newTip;
}
async function getPremiumPredictions(userId, isPremiumUser) {
  const now = /* @__PURE__ */ new Date();
  if (userId && isPremiumUser) {
    return db.select().from(predictions).where(
      and(
        eq2(predictions.isPremium, true),
        eq2(predictions.isLive, false),
        gte(predictions.matchTime, now),
        isNull(predictions.result),
        sql4`(${predictions.userId} = ${userId} OR ${predictions.userId} IS NULL)`,
        sql4`${predictions.explanation} NOT LIKE '[DEMO]%'`
      )
    ).orderBy(predictions.matchTime);
  }
  return db.select().from(predictions).where(
    and(
      eq2(predictions.isPremium, true),
      isNull(predictions.userId),
      eq2(predictions.isLive, false),
      gte(predictions.matchTime, now),
      isNull(predictions.result)
    )
  ).orderBy(predictions.matchTime);
}
async function getLivePredictions(userId, isPremiumUser) {
  if (!isPremiumUser) {
    return [];
  }
  const now = /* @__PURE__ */ new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1e3);
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1e3);
  return db.select().from(predictions).where(
    and(
      sql4`${predictions.matchTime} <= ${sixHoursFromNow.toISOString()}::timestamp`,
      sql4`${predictions.matchTime} >= ${threeHoursAgo.toISOString()}::timestamp`,
      isNull(predictions.result),
      isNull(predictions.userId)
    )
  ).orderBy(predictions.matchTime);
}
async function getHistoryPredictions(userId, isPremiumUser, premiumSince) {
  const fiveDaysAgo = /* @__PURE__ */ new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const thirtyDaysAgo = /* @__PURE__ */ new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dedup = (rows2) => {
    const seen2 = /* @__PURE__ */ new Set();
    return rows2.filter((r) => {
      const clean = r.matchTitle.replace(" (O/U)", "");
      const key = clean.split(" vs ").map((s) => s.trim()).sort().join("|");
      if (seen2.has(key)) return false;
      seen2.add(key);
      return true;
    });
  };
  const rows = await db.select().from(predictions).where(
    and(
      eq2(predictions.result, "correct"),
      isNull(predictions.userId),
      sql4`${predictions.matchTime} >= ${thirtyDaysAgo.toISOString()}::timestamp`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )
  ).orderBy(desc2(predictions.matchTime), asc(predictions.isPremium));
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const r of rows) {
    const teamKey = r.matchTitle.replace(" (O/U)", "").split(" vs ").map((s) => s.trim()).sort().join("|");
    const dateKey = r.matchTime ? new Date(r.matchTime).toISOString().split("T")[0] : "";
    const key = `${teamKey}__${dateKey}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }
  return deduped;
}
async function getPredictionsBySport(sport, userId, isPremiumUser) {
  const now = /* @__PURE__ */ new Date();
  if (userId && isPremiumUser) {
    const allPredictions = await db.select().from(predictions).where(
      and(
        eq2(predictions.sport, sport),
        gte(predictions.matchTime, now),
        isNull(predictions.result),
        eq2(predictions.isLive, false),
        sql4`(${predictions.userId} = ${userId} OR ${predictions.userId} IS NULL)`,
        sql4`${predictions.explanation} NOT LIKE '[DEMO]%'`
      )
    ).orderBy(predictions.matchTime);
    const seen = /* @__PURE__ */ new Set();
    const deduped2 = [];
    const sorted = [...allPredictions].sort((a, b) => {
      if (a.userId && !b.userId) return -1;
      if (!a.userId && b.userId) return 1;
      return 0;
    });
    for (const p of sorted) {
      const key = p.matchTitle.replace(" (O/U)", "").split(" vs ").map((s) => s.trim()).sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        deduped2.push(p);
      }
    }
    return deduped2.sort((a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime());
  }
  const sportPredictions = await db.select().from(predictions).where(
    and(
      eq2(predictions.sport, sport),
      gte(predictions.matchTime, now),
      isNull(predictions.result),
      eq2(predictions.isLive, false),
      isNull(predictions.userId)
      // Only demo predictions
    )
  ).orderBy(predictions.matchTime);
  const seenFree = /* @__PURE__ */ new Set();
  const seenPremium = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const p of sportPredictions) {
    const key = p.matchTitle.replace(" (O/U)", "").split(" vs ").map((s) => s.trim()).sort().join("|");
    if (!p.isPremium) {
      if (!seenFree.has(key)) {
        seenFree.add(key);
        deduped.push(p);
      }
    } else {
      if (!seenPremium.has(key)) {
        seenPremium.add(key);
        deduped.push(p);
      }
    }
  }
  return deduped.sort((a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime());
}
async function getPredictionById(id) {
  const [prediction] = await db.select().from(predictions).where(eq2(predictions.id, id)).limit(1);
  return prediction || null;
}
async function markPredictionResult(id, result) {
  await db.update(predictions).set({ result }).where(eq2(predictions.id, id));
}
async function getSportPredictionCounts(userId, isPremiumUser) {
  const sports = ["football", "basketball", "tennis", "baseball", "hockey", "cricket", "mma", "golf"];
  const counts = {};
  for (const sport of sports) {
    const sportPredictions = await getPredictionsBySport(sport, userId, isPremiumUser);
    counts[sport] = sportPredictions.length;
  }
  return counts;
}
async function resolvePredictionResults(includeOddsApi = false) {
  const now = /* @__PURE__ */ new Date();
  const FINISH_BUFFER_HOURS = 2;
  const finishBufferAgo = new Date(now.getTime() - FINISH_BUFFER_HOURS * 60 * 60 * 1e3);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1e3);
  const unresolved = await db.select().from(predictions).where(
    and(
      sql4`${predictions.matchTime} < ${finishBufferAgo.toISOString()}::timestamp`,
      sql4`${predictions.matchTime} >= ${fourteenDaysAgo.toISOString()}::timestamp`,
      sql4`(${predictions.result} IS NULL OR ${predictions.result} = 'unresolved')`
    )
  );
  if (unresolved.length === 0) {
    console.log("No predictions to resolve");
    return;
  }
  const completedGames = await getRecentCompletedGames(includeOddsApi);
  if (completedGames.length === 0) {
    console.log("No completed games to resolve against");
    return;
  }
  const sportCounts = completedGames.reduce((acc, g) => {
    acc[g.sport] = (acc[g.sport] || 0) + 1;
    return acc;
  }, {});
  console.log(`[RESOLVE] ESPN completed games by sport: ${JSON.stringify(sportCounts)}`);
  console.log(`[RESOLVE] Checking ${unresolved.length} unresolved predictions against ${completedGames.length} completed games`);
  let correct = 0;
  let incorrect = 0;
  for (const pred of unresolved) {
    const parts = pred.matchTitle.split(" vs ");
    if (parts.length < 2) continue;
    const baseTitle = pred.matchTitle.replace(/ \(O\/U\)$/, "");
    const [predHome, predAway] = baseTitle.split(" vs ").map((s) => s.trim().toLowerCase());
    const normalize = (name) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^(the|fc|afc|cf|sc|rc|ac|as|sd|vf|vfb|fsv|sv|tsg|rb|rw|bv|hsv|ssv|tsv|bsc|esv|dsv|rsv|msv|wsv|csv|gsv|osv|usv|bc|hc|kc|cc|dc|ec|mc|nk|sk|gk|fk|rk|mk|bk|ak|ok|pk|tk|uk|ik|jk|lk|zk)\s+/i, "").replace(/\s+(fc|sc|bc|hc|kc|cc|dc|ec|mc|united|city|town|rovers|wanderers|athletic|athletics|county|albion|hotspur|wednesday|tuesday|monday|villa|palace|forest|rangers|celtic|thistle|hearts|hibs|boro|utd|afc|cf)$/i, "").replace(/[^a-z0-9]/g, "");
    const SKIP_WORDS = /* @__PURE__ */ new Set(["the", "and", "for", "city", "town", "state", "united", "athletic", "athletics", "united", "county", "rovers", "wanderers", "real", "club", "sport", "sports", "new", "old", "north", "south", "east", "west", "central", "national", "fc", "sc", "bc", "hc", "afc", "utd", "cf", "super", "royal"]);
    const meaningfulWords = (name) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter((w) => w.length >= 4 && !SKIP_WORDS.has(w));
    const wordOverlap = (espnName, predName) => {
      const espnWords = meaningfulWords(espnName);
      const predWords = meaningfulWords(predName);
      if (espnWords.length === 0 || predWords.length === 0) return false;
      return predWords.some((pw) => espnWords.some((ew) => ew.includes(pw) || pw.includes(ew)));
    };
    const predMatchTime = new Date(pred.matchTime);
    const MATCH_WINDOW_MS = 12 * 60 * 60 * 1e3;
    const dateDiff = (gameTime) => Math.abs(gameTime.getTime() - predMatchTime.getTime());
    const isDateClose = (gameTime) => dateDiff(gameTime) <= MATCH_WINDOW_MS;
    const pickClosest = (candidates) => {
      if (candidates.length === 0) return void 0;
      return candidates.reduce(
        (best, g) => dateDiff(g.matchTime) < dateDiff(best.matchTime) ? g : best
      );
    };
    const exactCandidates = completedGames.filter((g) => {
      if (!isDateClose(g.matchTime)) return false;
      const gHome = normalize(g.homeTeam);
      const gAway = normalize(g.awayTeam);
      const pH = normalize(predHome);
      const pA = normalize(predAway);
      return (gHome.includes(pH) || pH.includes(gHome)) && (gAway.includes(pA) || pA.includes(gAway)) || (gHome.includes(pA) || pA.includes(gHome)) && (gAway.includes(pH) || pH.includes(gAway));
    });
    let matchedGame = pickClosest(exactCandidates);
    if (matchedGame && exactCandidates.length > 1) {
      console.log(`[RESOLVE] Series detected for "${pred.matchTitle}": ${exactCandidates.length} candidates, picked closest by date`);
    }
    if (!matchedGame) {
      const overlapCandidates = completedGames.filter((g) => {
        if (g.sport !== pred.sport) return false;
        if (!isDateClose(g.matchTime)) return false;
        return wordOverlap(g.homeTeam, predHome) && wordOverlap(g.awayTeam, predAway) || wordOverlap(g.homeTeam, predAway) && wordOverlap(g.awayTeam, predHome);
      });
      matchedGame = pickClosest(overlapCandidates);
      if (matchedGame) {
        console.log(`[RESOLVE] Word-overlap fallback matched: "${pred.matchTitle}" \u2192 ESPN: "${matchedGame.homeTeam} vs ${matchedGame.awayTeam}"${overlapCandidates.length > 1 ? ` (${overlapCandidates.length} candidates, picked closest)` : ""}`);
      }
    }
    if (!matchedGame) {
      try {
        const [rawHome, rawAway] = baseTitle.split(" vs ").map((s) => s.trim());
        const directResult = await lookupGameByTeams(rawHome, rawAway, pred.sport);
        if (directResult && isDateClose(directResult.matchTime)) {
          matchedGame = directResult;
          console.log(`[RESOLVE] Team-lookup matched: "${pred.matchTitle}" \u2192 "${matchedGame.homeTeam} vs ${matchedGame.awayTeam}" (${matchedGame.homeScore}-${matchedGame.awayScore})`);
        }
      } catch {
      }
    }
    if (!matchedGame) {
      console.log(`[RESOLVE] No match found for: "${pred.matchTitle}" (sport: ${pred.sport})`);
      continue;
    }
    if (!matchedGame.winner || matchedGame.homeScore == null || matchedGame.awayScore == null || isNaN(matchedGame.homeScore) || isNaN(matchedGame.awayScore)) {
      console.log(`[RESOLVE] Skipping "${pred.matchTitle}" \u2014 score data missing (winner: ${matchedGame.winner}, score: ${matchedGame.homeScore}-${matchedGame.awayScore})`);
      continue;
    }
    console.log(`[RESOLVE] Matched: "${pred.matchTitle}" \u2192 "${matchedGame.homeTeam} vs ${matchedGame.awayTeam}", winner: ${matchedGame.winner}, score: ${matchedGame.homeScore}-${matchedGame.awayScore}, predicted: "${pred.predictedOutcome}"`);
    const totalScore = matchedGame.homeScore + matchedGame.awayScore;
    const isOverUnder = /^(over|under)\s+[\d.]+$/i.test(pred.predictedOutcome);
    let isCorrect = false;
    let scoreLine = `${matchedGame.winner} won ${matchedGame.homeScore}-${matchedGame.awayScore}`;
    if (isOverUnder) {
      const parts2 = pred.predictedOutcome.match(/^(over|under)\s+([\d.]+)$/i);
      if (parts2) {
        const direction = parts2[1].toLowerCase();
        const line = parseFloat(parts2[2]);
        isCorrect = direction === "over" ? totalScore > line : totalScore < line;
        scoreLine = `Final score: ${matchedGame.homeScore}-${matchedGame.awayScore} (Total: ${totalScore}, Line: ${line})`;
      }
    } else {
      const predictedWinner = pred.predictedOutcome.replace(/ Win$/i, "").trim();
      isCorrect = matchedGame.winner.toLowerCase().includes(predictedWinner.toLowerCase()) || predictedWinner.toLowerCase().includes(matchedGame.winner.toLowerCase());
    }
    if (isCorrect) {
      await db.update(predictions).set({ result: "correct" }).where(eq2(predictions.id, pred.id));
      correct++;
    } else {
      await db.update(predictions).set({ result: "incorrect" }).where(eq2(predictions.id, pred.id));
      incorrect++;
    }
  }
  console.log(`Resolved predictions: ${correct} correct, ${incorrect} marked incorrect out of ${unresolved.length}`);
  const sixHoursAgoForFlip = new Date(now.getTime() - 6 * 60 * 60 * 1e3);
  const flipped = await db.update(predictions).set({ result: "unresolved" }).where(
    and(
      isNull(predictions.userId),
      isNull(predictions.result),
      sql4`${predictions.matchTime} < ${sixHoursAgoForFlip.toISOString()}::timestamp`,
      sql4`${predictions.matchTime} >= ${fourteenDaysAgo.toISOString()}::timestamp`
    )
  ).returning({ id: predictions.id, matchTitle: predictions.matchTitle });
  if (flipped.length > 0) {
    console.log(`[RESOLVE] Flipped ${flipped.length} stuck NULL predictions to 'unresolved' for AI fallback: ${flipped.map((f) => f.matchTitle).join(", ")}`);
  }
  const activeTip = await getTodaysActiveFreePrediction();
  if (!activeTip) {
    console.log("Free tip was lost or expired \u2014 auto-generating replacement...");
    try {
      await generateDailyFreePrediction();
      const newTip = await getTodaysActiveFreePrediction();
      if (newTip) {
        console.log(`Replacement free tip generated: ${newTip.matchTitle}`);
      }
    } catch (err) {
      console.error("Failed to auto-replace lost free tip:", err);
    }
  }
}
async function clearExpiredPredictions() {
  const now = /* @__PURE__ */ new Date();
  const threeDaysAgo = /* @__PURE__ */ new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const startOfToday = getStartOfToday();
  await db.delete(predictions).where(
    and(
      sql4`${predictions.matchTime} < ${now.toISOString()}::timestamp`,
      isNull(predictions.result),
      eq2(predictions.isPremium, false),
      sql4`${predictions.createdAt} < ${startOfToday.toISOString()}::timestamp`
    )
  );
  const thirtyOneDaysAgo = /* @__PURE__ */ new Date();
  thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
  await db.delete(predictions).where(
    and(
      eq2(predictions.isPremium, true),
      sql4`${predictions.matchTime} < ${thirtyOneDaysAgo.toISOString()}::timestamp`,
      sql4`${predictions.expiresAt} = ${predictions.matchTime}`
    )
  );
  await db.delete(predictions).where(
    and(
      eq2(predictions.isPremium, true),
      sql4`${predictions.result} IS NOT NULL`,
      sql4`${predictions.matchTime} < ${thirtyOneDaysAgo.toISOString()}::timestamp`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )
  );
  console.log(`Cleared expired predictions`);
  return 0;
}
function isConnectionError(error) {
  if (error instanceof Error) {
    const code = error.code;
    if (code === "CONNECTION_CLOSED" || code === "CONNECTION_ENDED" || code === "CONNECT_TIMEOUT") {
      return true;
    }
    if (error.message.includes("CONNECTION_CLOSED") || error.message.includes("ECONNRESET") || error.message.includes("ECONNREFUSED") || error.message.includes("write CONNECTION_CLOSED")) {
      return true;
    }
  }
  return false;
}
async function runWithRetry(fn, label, maxRetries = 3, delayMs = 5e3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (isConnectionError(error) && attempt < maxRetries) {
        console.warn(`[${label}] Connection error on attempt ${attempt}/${maxRetries}, retrying in ${delayMs / 1e3}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`[${label}] Exhausted all ${maxRetries} retries`);
}
async function reverifyResolutionsAfterWindowFix() {
  if (Date.now() > (/* @__PURE__ */ new Date("2026-05-01T00:00:00Z")).getTime()) return;
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3);
  const reset = await db.update(predictions).set({ result: null }).where(
    and(
      sql4`${predictions.result} IS NOT NULL`,
      sql4`${predictions.matchTime} >= ${threeDaysAgo.toISOString()}::timestamp`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )
  ).returning({ id: predictions.id, matchTitle: predictions.matchTitle });
  if (reset.length > 0) {
    console.log(`[REVERIFY] Reset ${reset.length} predictions resolved with old wide-window matcher; resolver will re-check with tightened window`);
  }
}
async function fixPrematurelyResolvedPredictions() {
  const resetted = await db.update(predictions).set({ result: null }).where(
    and(
      sql4`${predictions.result} IS NOT NULL`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`,
      sql4`extract(epoch from (${predictions.createdAt} - ${predictions.matchTime})) BETWEEN -3600 AND 3600`
    )
  ).returning({ id: predictions.id, matchTitle: predictions.matchTitle });
  if (resetted.length > 0) {
    console.log(`Reset ${resetted.length} prematurely resolved predictions: ${resetted.map((r) => r.matchTitle).join(", ")}`);
  }
  const fabricated = await db.delete(predictions).where(
    and(
      eq2(predictions.isPremium, true),
      sql4`${predictions.result} IS NOT NULL`,
      sql4`${predictions.expiresAt} = ${predictions.matchTime}`,
      sql4`${predictions.createdAt} = ${predictions.matchTime}`
    )
  ).returning({ id: predictions.id });
  if (fabricated.length > 0) {
    console.log(`Removed ${fabricated.length} fabricated premium history entries`);
  }
}
async function purgeFakeHistoryEntries() {
  await db.delete(predictions).where(
    and(
      isNull(predictions.userId),
      eq2(predictions.isPremium, true),
      sql4`${predictions.result} IS NOT NULL`,
      sql4`${predictions.expiresAt} = ${predictions.matchTime}`,
      sql4`(${predictions.explanation} LIKE '%Our AI correctly predicted this outcome%' OR ${predictions.explanation} LIKE 'Final score:%')`
    )
  );
  const realPredictions = await db.select({ matchTitle: predictions.matchTitle }).from(predictions).where(
    and(
      isNull(predictions.userId),
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )
  );
  if (realPredictions.length > 0) {
    const normalizeMatchup = (t) => t.replace(/ \(O\/U\)$/, "").split(" vs ").map((s) => s.trim()).sort().join("|");
    const realTitlesNormalized = new Set(realPredictions.map((p) => normalizeMatchup(p.matchTitle)));
    const retroactiveEntries = await db.select({ id: predictions.id, matchTitle: predictions.matchTitle }).from(predictions).where(
      and(
        isNull(predictions.userId),
        sql4`${predictions.expiresAt} = ${predictions.matchTime}`
      )
    );
    const toDelete = retroactiveEntries.filter((e) => realTitlesNormalized.has(normalizeMatchup(e.matchTitle))).map((e) => e.id);
    if (toDelete.length > 0) {
      await db.delete(predictions).where(sql4`${predictions.id} = ANY(ARRAY[${sql4.join(toDelete.map((id) => sql4`${id}`), sql4`, `)}]::int[])`);
      console.log(`Removed ${toDelete.length} retroactive history entries that conflicted with real AI predictions`);
    }
  }
  console.log("Purged fake premium history entries");
}
async function resetAndGenerateDailyFreeTip() {
  const startOfToday = getStartOfToday();
  await db.delete(predictions).where(
    and(
      eq2(predictions.isPremium, false),
      isNull(predictions.userId),
      sql4`${predictions.createdAt} < ${startOfToday.toISOString()}::timestamp`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`,
      sql4`(${predictions.result} IS NULL OR ${predictions.result} = 'incorrect')`
    )
  );
  console.log("Midnight reset: cleared previous day's unresolved/incorrect free tips (winners preserved for history)");
  isGeneratingFreeTip = false;
  await _generateDailyFreeTip();
}
async function dailyPredictionRefresh() {
  console.log("Starting daily prediction refresh...");
  try {
    await runWithRetry(() => purgeFakeHistoryEntries(), "purgeFakeHistoryEntries");
    await runWithRetry(() => fixPrematurelyResolvedPredictions(), "fixPrematurelyResolvedPredictions");
    await runWithRetry(() => reverifyResolutionsAfterWindowFix(), "reverifyResolutionsAfterWindowFix");
    await runWithRetry(() => resolvePredictionResults(true), "resolvePredictionResults");
    await runWithRetry(() => clearExpiredPredictions(), "clearExpiredPredictions");
    await runWithRetry(() => resetAndGenerateDailyFreeTip(), "resetAndGenerateDailyFreeTip");
    await runWithRetry(() => refreshDemoPredictions(), "refreshDemoPredictions");
    console.log("Daily prediction refresh completed successfully");
    const { notifyDailyFreePredictionReady: notifyDailyFreePredictionReady2 } = await Promise.resolve().then(() => (init_pushNotificationService(), pushNotificationService_exports));
    await notifyDailyFreePredictionReady2();
  } catch (error) {
    console.error("Error during daily prediction refresh:", error);
    throw error;
  }
}
async function refreshDemoPredictions(espnOnly = false) {
  console.log(`Refreshing premium predictions with real API games...${espnOnly ? " [ESPN-only mode]" : ""}`);
  const now = /* @__PURE__ */ new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1e3);
  const unresolved = await db.update(predictions).set({ result: "unresolved" }).where(
    and(
      isNull(predictions.userId),
      isNull(predictions.result),
      sql4`${predictions.matchTime} < ${sixHoursAgo.toISOString()}::timestamp`
    )
  ).returning({ id: predictions.id });
  if (unresolved.length > 0) {
    console.log(`Marked ${unresolved.length} unresolved past predictions (ESPN could not match)`);
  }
  const existing = await db.select().from(predictions).where(
    and(
      eq2(predictions.isPremium, true),
      isNull(predictions.userId),
      sql4`${predictions.matchTime} > ${now.toISOString()}::timestamp`
    )
  );
  const usingEspnOnly = espnOnly || isUsingFallbackData();
  const PER_SPORT_TARGET = 3;
  const TOTAL_TARGET = 40;
  const coreSports = ["football", "basketball", "baseball", "hockey", "mma"];
  const allSports = [...coreSports, "tennis", "golf", ...usingEspnOnly ? [] : ["cricket"]];
  const sportCounts = {};
  for (const sport of allSports) {
    sportCounts[sport] = existing.filter((p) => p.sport === sport).length;
  }
  const underCoveredSports = allSports.filter((s) => sportCounts[s] < PER_SPORT_TARGET);
  console.log(`[REFRESH] Per-sport counts: ${JSON.stringify(sportCounts)} (target ${PER_SPORT_TARGET}/sport, ${TOTAL_TARGET} total)`);
  if (existing.length >= TOTAL_TARGET && underCoveredSports.length === 0) {
    console.log(`Premium predictions sufficient: ${existing.length} real games covering all sports`);
    return;
  }
  if (underCoveredSports.length > 0) {
    console.log(`Under-covered sports (<${PER_SPORT_TARGET}): ${underCoveredSports.join(", ")} \u2014 regenerating...`);
  } else {
    console.log(`Only ${existing.length}/${TOTAL_TARGET} premium predictions, fetching more real games from API...`);
  }
  await refreshUpcomingMatches(espnOnly);
  await generateDemoPredictions();
}
async function checkAndReplaceFreeTip() {
  try {
    await resolvePredictionResults();
  } catch (err) {
    console.error("Error during free tip resolution check:", err);
  }
  try {
    const activeTip = await getTodaysActiveFreePrediction();
    if (!activeTip) {
      console.log("Periodic check: no active free tip found \u2014 generating replacement...");
      await generateDailyFreePrediction();
      const newTip = await getTodaysActiveFreePrediction();
      if (newTip) {
        console.log(`Periodic replacement free tip generated: ${newTip.matchTitle}`);
        try {
          const { notifyDailyFreePredictionReady: notifyDailyFreePredictionReady2 } = await Promise.resolve().then(() => (init_pushNotificationService(), pushNotificationService_exports));
          await notifyDailyFreePredictionReady2();
        } catch (err) {
          console.error("Failed to send push notification for replacement tip:", err);
        }
      }
    }
  } catch (err) {
    console.error("Error during periodic free tip replacement:", err);
  }
}
async function logDailyResolutionSummary() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const rows = await db.select({
    result: predictions.result,
    total: sql4`count(*)::int`
  }).from(predictions).where(
    and(
      isNull(predictions.userId),
      sql4`${predictions.matchTime} >= ${yesterday.toISOString()}::timestamp`,
      sql4`${predictions.expiresAt} > ${predictions.matchTime}`
    )
  ).groupBy(predictions.result);
  const counts = {};
  for (const r of rows) counts[r.result ?? "pending"] = r.total;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const correct = counts["correct"] ?? 0;
  const incorrect = counts["incorrect"] ?? 0;
  const pending = counts["pending"] ?? 0;
  const unresolved = counts["unresolved"] ?? 0;
  const resolved = correct + incorrect;
  const rate = resolved > 0 ? Math.round(correct / resolved * 100) : 0;
  console.log(
    `[DAILY SUMMARY] Last 24h real predictions: ${total} total | ${correct} correct | ${incorrect} incorrect | ${pending} pending | ${unresolved} unresolved | Accuracy: ${rate}% (${resolved} resolved)`
  );
}
function startDailyRefreshScheduler() {
  const THIRTY_MINUTES = 30 * 60 * 1e3;
  const SIX_HOURS = 6 * 60 * 60 * 1e3;
  const RETRY_DELAY = 5 * 60 * 1e3;
  console.log("Daily prediction refresh scheduler started");
  async function runRefreshWithRetry() {
    try {
      await dailyPredictionRefresh();
    } catch (err) {
      console.error("Daily refresh failed, scheduling retry in 5 minutes:", err);
      setTimeout(async () => {
        try {
          await dailyPredictionRefresh();
        } catch (retryErr) {
          console.error("Daily refresh retry also failed:", retryErr);
        }
      }, RETRY_DELAY);
    }
  }
  (async () => {
    const todayStart = /* @__PURE__ */ new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = /* @__PURE__ */ new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    const [existingFreeTip] = await db.select({ id: predictions.id }).from(predictions).where(
      and(
        eq2(predictions.isPremium, false),
        isNull(predictions.userId),
        isNull(predictions.result),
        sql4`${predictions.createdAt} >= ${todayStart.toISOString()}::timestamp`,
        sql4`${predictions.createdAt} <= ${todayEnd.toISOString()}::timestamp`
      )
    ).limit(1);
    if (existingFreeTip) {
      console.log("Today's free tip already exists \u2014 skipping startup refresh, running resolution + premium top-up only");
      try {
        await resolvePredictionResults();
      } catch (err) {
        console.error("Startup resolution check failed:", err);
      }
      try {
        await refreshDemoPredictions();
      } catch (err) {
        console.error("Startup premium top-up failed:", err);
      }
    } else {
      console.log("No free tip found for today \u2014 running full startup refresh");
      await runRefreshWithRetry();
    }
  })();
  function scheduleMidnightRefresh() {
    const now = /* @__PURE__ */ new Date();
    const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    console.log(`Next daily refresh scheduled at midnight UTC (in ${Math.round(msUntilMidnight / 6e4)} minutes)`);
    setTimeout(() => {
      runRefreshWithRetry();
      scheduleMidnightRefresh();
    }, msUntilMidnight);
  }
  scheduleMidnightRefresh();
  function schedule8amResolution() {
    const now = /* @__PURE__ */ new Date();
    const next8am = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
    if (next8am <= now) next8am.setUTCDate(next8am.getUTCDate() + 1);
    const msUntil8am = next8am.getTime() - now.getTime();
    console.log(`Morning catch-up resolution scheduled at 8 AM UTC (in ${Math.round(msUntil8am / 6e4)} minutes)`);
    setTimeout(async () => {
      console.log("[8AM CATCHUP] Running morning resolution pass for overnight game results...");
      try {
        await resolvePredictionResults();
        await logDailyResolutionSummary();
      } catch (err) {
        console.error("[8AM CATCHUP] Resolution failed:", err);
      }
      schedule8amResolution();
    }, msUntil8am);
  }
  schedule8amResolution();
  function scheduleNoonEspnTopUp() {
    const now = /* @__PURE__ */ new Date();
    const nextNoon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
    if (nextNoon <= now) nextNoon.setUTCDate(nextNoon.getUTCDate() + 1);
    const msUntilNoon = nextNoon.getTime() - now.getTime();
    console.log(`Noon ESPN-only top-up scheduled at 12 PM UTC (in ${Math.round(msUntilNoon / 6e4)} minutes)`);
    setTimeout(async () => {
      console.log("[NOON TOPUP] Running ESPN-only prediction top-up...");
      try {
        await refreshDemoPredictions(true);
      } catch (err) {
        console.error("[NOON TOPUP] Failed:", err);
      }
      scheduleNoonEspnTopUp();
    }, msUntilNoon);
  }
  scheduleNoonEspnTopUp();
  setInterval(async () => {
    try {
      await resolvePredictionResults();
    } catch (err) {
      console.error("Intraday resolution check failed:", err);
    }
    checkAndReplaceFreeTip();
  }, THIRTY_MINUTES);
}

// server/routes.ts
var adminRateLimit = rateLimit({ windowMs: 15 * 60 * 1e3, max: 30 });
var registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(100),
  referralCode: z.string().max(20).optional()
});
var loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128)
});
var isoDateString = z.string().refine(
  (s) => !isNaN(Date.parse(s)),
  { message: "Invalid date/time format" }
);
var historyEntrySchema = z.object({
  matchTitle: z.string().min(1).max(500),
  sport: z.string().min(1).max(50),
  matchTime: isoDateString,
  predictedOutcome: z.string().min(1).max(500),
  probability: z.number().min(0).max(100),
  confidence: z.enum(["high", "medium", "low"]),
  explanation: z.string().max(2e3).nullable().optional(),
  factors: z.array(z.string().max(500)).max(20).nullable().optional(),
  sportsbookOdds: z.record(z.string(), z.any()).nullable().optional(),
  riskIndex: z.number().min(0).max(10).optional(),
  isPremium: z.boolean().optional(),
  expiresAt: isoDateString.optional()
});
var addHistorySchema = z.object({
  entries: z.array(historyEntrySchema).min(1).max(100)
});
var fixMigratedSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500)
});
function isAnnualProduct(productId) {
  const id = String(productId || "").toLowerCase();
  return id.includes("annual") || id.includes("yearly") || /(^|[^a-z])year([^a-z]|$)/.test(id);
}
function safeErrorMessage(error, fallback = "An unexpected error occurred") {
  if (error instanceof z.ZodError) {
    return error.errors.map((e) => e.message).join(", ");
  }
  if (typeof error?.message === "string" && error.message.length < 200) {
    if (/password|secret|key|token|sql|query|column|table|relation|database|stack|internal|connection|drizzle|postgres|pg_|stripe_|revenuecat|webhook|bcrypt|jwt|hash/i.test(error.message)) {
      return fallback;
    }
    return error.message;
  }
  return fallback;
}
function redactPrediction(p) {
  return {
    ...p,
    matchTitle: "Get Premium vs Get Premium",
    predictedOutcome: "Get Premium",
    probability: 90,
    confidence: "high",
    explanation: null,
    factors: null,
    sportsbookOdds: null,
    riskIndex: 0
  };
}
var loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1e3, max: 20 });
var registerRateLimit = rateLimit({ windowMs: 60 * 60 * 1e3, max: 10 });
var contactRateLimit = rateLimit({ windowMs: 60 * 60 * 1e3, max: 5 });
var generateRateLimit = rateLimit({ windowMs: 60 * 1e3, max: 3 });
var apiReadRateLimit = rateLimit({ windowMs: 60 * 1e3, max: 60 });
var apiWriteRateLimit = rateLimit({ windowMs: 60 * 1e3, max: 15 });
async function registerRoutes(app2) {
  app2.post("/api/auth/register", registerRateLimit, async (req, res) => {
    try {
      const { email, password, name, referralCode } = registerSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();
      const deliverability = await validateEmailDeliverable(normalizedEmail);
      if (!deliverability.valid) {
        return res.status(400).json({ error: deliverability.reason || "Please enter a valid email address." });
      }
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Unable to create account. Please try a different email or sign in." });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await storage.createUser({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim()
      }, referralCode);
      setCachedTokenVersion(user.id, 0);
      const token = signToken(user.id, 0);
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isPremium: user.isPremium,
          subscriptionExpiry: user.subscriptionExpiry
        },
        token
      });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Registration failed") });
    }
  });
  app2.delete("/api/auth/account", requireAuth, apiWriteRateLimit, async (req, res) => {
    try {
      console.log(`Account deletion requested by user ${req.userId} \u2014 deletes disabled, returning success`);
      return res.json({ success: true });
    } catch (error) {
      console.error("Account deletion error:", error);
      return res.status(500).json({ error: "Failed to delete account" });
    }
  });
  app2.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      let newTokenVersion;
      try {
        const result = await db.execute(
          sql5`UPDATE users SET token_version = token_version + 1 WHERE id = ${user.id} RETURNING token_version`
        );
        const rows = Array.isArray(result) ? result : result?.rows ?? [];
        const bumped = rows[0]?.token_version;
        if (bumped === void 0 || bumped === null) {
          throw new Error("token_version bump returned no rows");
        }
        newTokenVersion = Number(bumped);
      } catch (err) {
        console.error("[AUTH] failed to bump token_version on login:", err.message);
        return res.status(500).json({ error: "Could not start session. Please try again." });
      }
      setCachedTokenVersion(user.id, newTokenVersion);
      const token = signToken(user.id, newTokenVersion);
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isPremium: user.isPremium,
          subscriptionExpiry: user.subscriptionExpiry
        },
        token
      });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Login failed") });
    }
  });
  app2.get("/api/stripe/config", apiReadRateLimit, async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/products", apiReadRateLimit, async (_req, res) => {
    try {
      const products = await storage.listProducts();
      res.json({ data: products });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/products-with-prices", apiReadRateLimit, async (_req, res) => {
    try {
      const rows = await storage.listProductsWithPrices();
      const productsMap = /* @__PURE__ */ new Map();
      for (const row of rows) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active
          });
        }
      }
      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/prices", apiReadRateLimit, async (_req, res) => {
    try {
      const prices = await storage.listPrices();
      res.json({ data: prices });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const stripePriceMonthly = process.env.EXPO_PUBLIC_STRIPE_PRICE_MONTHLY;
  const stripePriceAnnual = process.env.EXPO_PUBLIC_STRIPE_PRICE_ANNUAL;
  const checkoutEnabled = Boolean(stripePriceMonthly && stripePriceAnnual);
  if (!checkoutEnabled) {
    console.warn(
      "Stripe checkout disabled: missing env vars (EXPO_PUBLIC_STRIPE_PRICE_MONTHLY / EXPO_PUBLIC_STRIPE_PRICE_ANNUAL)."
    );
  }
  const allowedPriceIds = new Set(
    [stripePriceMonthly, stripePriceAnnual].filter(Boolean)
  );
  app2.get("/api/billing/config", apiReadRateLimit, (_req, res) => {
    res.json({
      prices: {
        monthly: stripePriceMonthly || null,
        annual: stripePriceAnnual || null
      }
    });
  });
  const checkoutSchema = z.object({
    priceId: z.string().min(1).max(200).refine(
      (id) => allowedPriceIds.has(id),
      { message: "Invalid subscription plan" }
    )
  });
  app2.post("/api/checkout", requireAuth, apiWriteRateLimit, async (req, res) => {
    if (!checkoutEnabled) {
      return res.status(503).json({ error: "Checkout is currently unavailable. Stripe price configuration is missing." });
    }
    try {
      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { priceId } = parsed.data;
      const userId = req.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email, user.id);
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      } else {
        try {
          await stripeService.getCustomer(customerId);
        } catch (customerError) {
          if (customerError.code === "resource_missing") {
            const customer = await stripeService.createCustomer(user.email, user.id);
            await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
            customerId = customer.id;
          } else {
            throw customerError;
          }
        }
      }
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/checkout/cancel`
      );
      res.json({ url: session.url });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/subscription/:userId", optionalAuth, apiReadRateLimit, async (req, res) => {
    try {
      const userId = req.params.userId;
      if (req.userId && req.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      let user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (!user.isPremium) {
        try {
          const rcStatus = await Promise.race([
            checkRCSubscription(userId),
            new Promise((resolve3) => setTimeout(() => resolve3(null), 4e3))
          ]);
          if (rcStatus?.isPremium) {
            const isAnnual = isAnnualProduct(rcStatus.productIdentifier);
            const expiry = rcStatus.expiryDate ?? (() => {
              const d = /* @__PURE__ */ new Date();
              isAnnual ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
              return d;
            })();
            await storage.updateUserStripeInfo(userId, {
              isPremium: true,
              subscriptionExpiry: expiry,
              premiumSince: /* @__PURE__ */ new Date()
            });
            user = { ...user, isPremium: true, subscriptionExpiry: expiry };
            console.log(`[RC] sync check activated premium for user ${userId}`);
          }
        } catch (err) {
          console.error(`[RC] sync check failed for user ${userId}:`, err);
        }
      }
      if (!user.stripeSubscriptionId) {
        return res.json({
          subscription: null,
          isPremium: user.isPremium || false,
          expiryDate: user.subscriptionExpiry
        });
      }
      const subscription = await storage.getSubscription(user.stripeSubscriptionId);
      res.json({
        subscription,
        isPremium: user.isPremium,
        expiryDate: user.subscriptionExpiry
      });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const revenueCatSyncSchema = z.object({
    isSubscribed: z.boolean(),
    productIdentifier: z.string().max(200).optional(),
    // userId sent by client as fallback when auth token is expired
    userId: z.string().uuid().optional()
  });
  const syncRateLimit = rateLimit({ windowMs: 60 * 1e3, max: 5 });
  app2.post("/api/revenuecat/sync", optionalAuth, syncRateLimit, async (req, res) => {
    try {
      const parsed = revenueCatSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { isSubscribed, productIdentifier, userId: bodyUserId } = parsed.data;
      const userId = req.userId ?? bodyUserId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const jwtAuthenticated = !!req.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const isStripePayment = String(productIdentifier || "").startsWith("stripe_");
      if (isSubscribed) {
        let expiry;
        let source = "client-claim";
        if (!isStripePayment) {
          const rcStatus = await checkRCSubscription(userId);
          if (rcStatus?.isPremium) {
            expiry = rcStatus.expiryDate ?? (() => {
              const d = /* @__PURE__ */ new Date();
              const isAnn = isAnnualProduct(productIdentifier);
              isAnn ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
              return d;
            })();
            source = "RC-verified";
          } else if (!jwtAuthenticated) {
            console.log(`RevenueCat sync: unauthenticated claim rejected for user ${userId} \u2014 RC did not confirm`);
            return res.status(403).json({ error: "Could not verify subscription. Please try again." });
          } else {
            expiry = (() => {
              const d = /* @__PURE__ */ new Date();
              const isAnn = isAnnualProduct(productIdentifier);
              isAnn ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
              return d;
            })();
          }
        } else {
          expiry = (() => {
            const d = /* @__PURE__ */ new Date();
            const isAnn = isAnnualProduct(productIdentifier);
            isAnn ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
            return d;
          })();
        }
        const wasAlreadyPremium = user.isPremium === true;
        const updateData = {
          isPremium: true,
          subscriptionExpiry: expiry
        };
        if (!wasAlreadyPremium) {
          updateData.premiumSince = /* @__PURE__ */ new Date();
        }
        await storage.updateUserStripeInfo(userId, updateData);
        const isAnnual = isAnnualProduct(productIdentifier);
        console.log(`RevenueCat sync [${source}]: user ${userId} \u2192 isPremium=true (${isAnnual ? "annual" : "monthly"})`);
        return res.json({ isPremium: true, subscriptionExpiry: expiry });
      } else {
        if (jwtAuthenticated) {
          await storage.updateUserStripeInfo(userId, { isPremium: false });
          console.log(`RevenueCat sync [client-claim]: user ${userId} \u2192 isPremium=false`);
        }
        return res.json({ isPremium: false });
      }
    } catch (error) {
      console.error("RevenueCat sync error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/revenuecat/webhook", async (req, res) => {
    try {
      const event = req.body;
      const eventType = event?.event?.type;
      const productId = event?.event?.product_id;
      const expirationAtMs = event?.event?.expiration_at_ms;
      const transferredFrom = Array.isArray(event?.event?.transferred_from) ? event.event.transferred_from : [];
      const transferredTo = Array.isArray(event?.event?.transferred_to) ? event.event.transferred_to : [];
      const appUserId = event?.event?.app_user_id || (eventType === "TRANSFER" ? transferredTo[0] : void 0);
      console.log(
        `RevenueCat webhook received: type=${eventType} user=${appUserId} product=${productId}` + (eventType === "TRANSFER" ? ` from=[${transferredFrom.join(",")}] to=[${transferredTo.join(",")}]` : "")
      );
      if (!eventType) {
        console.warn("RevenueCat webhook: missing eventType", JSON.stringify(event).slice(0, 200));
        return res.status(400).json({ error: "Invalid webhook payload" });
      }
      if (eventType === "TRANSFER") {
        for (const fromId of transferredFrom) {
          const fromUser = await storage.getUser(String(fromId));
          if (fromUser) {
            await storage.updateUserStripeInfo(String(fromId), { isPremium: false });
            console.log(`RevenueCat webhook: TRANSFER \u2192 isPremium=false for ${fromId}`);
          }
        }
        for (const toId of transferredTo) {
          const toUser = await storage.getUser(String(toId));
          if (!toUser) {
            console.log(`RevenueCat webhook: TRANSFER target ${toId} not in DB (skipping activation)`);
            continue;
          }
          const expiry = expirationAtMs ? new Date(expirationAtMs) : (() => {
            const d = /* @__PURE__ */ new Date();
            isAnnualProduct(productId) ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
            return d;
          })();
          const update = { isPremium: true, subscriptionExpiry: expiry };
          if (!toUser.isPremium) update.premiumSince = /* @__PURE__ */ new Date();
          await storage.updateUserStripeInfo(String(toId), update);
          console.log(`RevenueCat webhook: TRANSFER \u2192 isPremium=true for ${toId}`);
        }
        return res.json({ received: true });
      }
      if (!appUserId) {
        console.warn("RevenueCat webhook: missing appUserId", JSON.stringify(event).slice(0, 200));
        return res.status(400).json({ error: "Invalid webhook payload" });
      }
      const user = await storage.getUser(String(appUserId));
      if (!user) {
        console.log(`RevenueCat webhook: user ${appUserId} not in DB (skipping)`);
        return res.json({ received: true });
      }
      const activatingEvents = ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"];
      const deactivatingEvents = ["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"];
      if (activatingEvents.includes(eventType)) {
        let expiry;
        if (expirationAtMs) {
          expiry = new Date(expirationAtMs);
        } else {
          expiry = /* @__PURE__ */ new Date();
          const isAnnual = isAnnualProduct(productId);
          isAnnual ? expiry.setFullYear(expiry.getFullYear() + 1) : expiry.setMonth(expiry.getMonth() + 1);
        }
        const webhookUpdate = { isPremium: true, subscriptionExpiry: expiry };
        if (!user.isPremium) webhookUpdate.premiumSince = /* @__PURE__ */ new Date();
        await storage.updateUserStripeInfo(String(appUserId), webhookUpdate);
        console.log(`RevenueCat webhook: ${eventType} \u2192 isPremium=true for ${appUserId}`);
      } else if (deactivatingEvents.includes(eventType)) {
        await storage.updateUserStripeInfo(String(appUserId), { isPremium: false });
        console.log(`RevenueCat webhook: ${eventType} \u2192 isPremium=false for ${appUserId}`);
      } else {
        console.log(`RevenueCat webhook: unhandled event type ${eventType}`);
      }
      res.json({ received: true });
    } catch (error) {
      console.error("RevenueCat webhook error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/customer-portal", requireAuth, apiWriteRateLimit, async (req, res) => {
    if (!checkoutEnabled) {
      return res.status(503).json({ error: "Billing portal is currently unavailable. Stripe is not configured." });
    }
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      if (!user || !user.stripeCustomerId) {
        return res.status(404).json({ error: "No subscription found" });
      }
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        baseUrl
      );
      res.json({ url: session.url });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/generate", requireAdmin, adminRateLimit, async (_req, res) => {
    try {
      await generateDailyPredictions();
      res.json({ success: true, message: "Predictions generated successfully" });
    } catch (error) {
      console.error("Error generating predictions:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/generate-demo", requireAdmin, adminRateLimit, async (_req, res) => {
    try {
      await generateDemoPredictions();
      res.json({ success: true, message: "Demo predictions generated successfully" });
    } catch (error) {
      console.error("Error generating demo predictions:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/trigger-refresh", requireAdmin, adminRateLimit, async (_req, res) => {
    try {
      res.json({ success: true, message: "Daily refresh started in background" });
      dailyPredictionRefresh().catch((err) => console.error("Background refresh error:", err));
    } catch (error) {
      console.error("Error triggering refresh:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/predictions/free-tip", apiReadRateLimit, async (_req, res) => {
    try {
      const freeTip = await getFreeTip();
      res.json({ prediction: freeTip });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/predictions/premium", apiReadRateLimit, optionalAuth, async (req, res) => {
    try {
      const userId = req.userId;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const preds = await getPremiumPredictions(userId, isPremiumUser);
      res.json({ predictions: isPremiumUser ? preds : preds.map(redactPrediction) });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/generate-premium", requireAuth, generateRateLimit, async (req, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (!user.isPremium) {
        return res.status(403).json({ error: "Premium subscription required" });
      }
      await generatePremiumPredictionsForUser(userId);
      res.json({ success: true, message: "Premium predictions generated for user" });
    } catch (error) {
      console.error("Error generating premium predictions:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/predictions/live", apiReadRateLimit, optionalAuth, async (req, res) => {
    try {
      const userId = req.userId;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const predictions2 = await getLivePredictions(userId, isPremiumUser);
      res.json({ predictions: predictions2 });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/live-matches", apiReadRateLimit, async (_req, res) => {
    try {
      const matches = await getLiveMatches();
      res.json({ matches });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/predictions/history", apiReadRateLimit, optionalAuth, async (req, res) => {
    try {
      const userId = req.userId;
      let isPremiumUser = false;
      let premiumSince = null;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
        premiumSince = u?.premiumSince || null;
      }
      const predictions2 = await getHistoryPredictions(userId, isPremiumUser, premiumSince);
      res.json({ predictions: predictions2 });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const allowedSports = /* @__PURE__ */ new Set(["football", "basketball", "baseball", "hockey", "tennis", "cricket", "mma", "golf"]);
  app2.get("/api/predictions/sport/:sport", apiReadRateLimit, optionalAuth, async (req, res) => {
    try {
      const sport = req.params.sport.toLowerCase().trim();
      if (!allowedSports.has(sport)) {
        return res.status(400).json({ error: "Invalid sport" });
      }
      const userId = req.userId;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const preds = await getPredictionsBySport(sport, userId, isPremiumUser);
      res.json({ predictions: isPremiumUser ? preds : preds.map((p) => p.isPremium ? redactPrediction(p) : p) });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/predictions/counts", apiReadRateLimit, optionalAuth, async (req, res) => {
    try {
      const userId = req.userId;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const counts = await getSportPredictionCounts(userId, isPremiumUser);
      res.json({ counts });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/predictions/:id", apiReadRateLimit, optionalAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ error: "Invalid prediction ID" });
      }
      const prediction = await getPredictionById(id);
      if (!prediction) {
        return res.status(404).json({ error: "Prediction not found" });
      }
      let isPremiumUser = false;
      if (req.userId) {
        const u = await storage.getUser(req.userId);
        isPremiumUser = u?.isPremium === true;
      }
      const isResolved = prediction.result === "correct" || prediction.result === "incorrect";
      const result = prediction.isPremium && !isPremiumUser && !isResolved ? redactPrediction(prediction) : prediction;
      res.json({ prediction: result });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/:id/result", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ error: "Invalid prediction ID" });
      }
      const { result } = req.body;
      if (result !== "correct" && result !== "incorrect") {
        return res.status(400).json({ error: "Result must be 'correct' or 'incorrect'" });
      }
      await markPredictionResult(id, result);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const editContentSchema = z.object({
    explanation: z.string().max(5e3).optional(),
    factors: z.array(z.object({
      title: z.string().max(200),
      impact: z.string().max(50),
      description: z.string().max(1e3)
    })).max(20).optional()
  });
  const fixMatchTimeSchema = z.object({
    matchTime: z.string().datetime(),
    resetResult: z.boolean().optional().default(true)
  });
  app2.post("/api/predictions/:id/fix-match-time", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ error: "Invalid prediction ID" });
      }
      const parsed = fixMatchTimeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { matchTime, resetResult } = parsed.data;
      const newMatchTime = new Date(matchTime);
      if (isNaN(newMatchTime.getTime())) {
        return res.status(400).json({ error: "Invalid matchTime" });
      }
      const newExpiresAt = new Date(newMatchTime.getTime() + 3 * 60 * 60 * 1e3);
      if (resetResult) {
        await db.execute(sql5`
          UPDATE predictions
          SET match_time = ${newMatchTime.toISOString()}::timestamp,
              expires_at = ${newExpiresAt.toISOString()}::timestamp,
              result = NULL
          WHERE id = ${id}
        `);
      } else {
        await db.execute(sql5`
          UPDATE predictions
          SET match_time = ${newMatchTime.toISOString()}::timestamp,
              expires_at = ${newExpiresAt.toISOString()}::timestamp
          WHERE id = ${id}
        `);
      }
      res.json({ success: true, id, matchTime: newMatchTime.toISOString(), expiresAt: newExpiresAt.toISOString(), resetResult });
    } catch (error) {
      console.error("Fix prediction matchTime error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/:id/edit-content", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ error: "Invalid prediction ID" });
      }
      const parsed = editContentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { explanation, factors } = parsed.data;
      if (explanation === void 0 && factors === void 0) {
        return res.status(400).json({ error: "Provide explanation and/or factors to update" });
      }
      if (explanation !== void 0 && factors !== void 0) {
        await db.execute(sql5`
          UPDATE predictions
          SET explanation = ${explanation},
              factors = ${JSON.stringify(factors)}::jsonb
          WHERE id = ${id}
        `);
      } else if (explanation !== void 0) {
        await db.execute(sql5`
          UPDATE predictions SET explanation = ${explanation} WHERE id = ${id}
        `);
      } else {
        await db.execute(sql5`
          UPDATE predictions SET factors = ${JSON.stringify(factors)}::jsonb WHERE id = ${id}
        `);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Edit prediction content error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const replaceTipSchema = z.object({
    matchTitle: z.string().min(1).max(500),
    sport: z.string().min(1).max(50),
    matchTime: z.string().datetime().optional(),
    predictedOutcome: z.string().max(500).optional(),
    probability: z.number().min(0).max(100).optional(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    explanation: z.string().max(5e3).optional(),
    factors: z.array(z.object({
      title: z.string().max(200),
      impact: z.string().max(50),
      description: z.string().max(1e3)
    })).optional(),
    sportsbookOdds: z.any().optional(),
    riskIndex: z.number().int().min(0).max(10).optional()
  });
  app2.post("/api/predictions/replace-free-tip", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const parsed = replaceTipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const newTip = await replaceFreeTip(parsed.data);
      res.json({ success: true, prediction: newTip });
    } catch (error) {
      console.error("Replace free tip error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/force-new-free-tip", requireAdmin, adminRateLimit, async (_req, res) => {
    try {
      await forceNewFreeTip();
      const tip = await getFreeTip();
      res.json({ success: true, prediction: tip });
    } catch (error) {
      console.error("Force new free tip error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/notifications/send-free-tip", requireAdmin, adminRateLimit, async (_req, res) => {
    try {
      const { notifyDailyFreePredictionReady: notifyDailyFreePredictionReady2 } = await Promise.resolve().then(() => (init_pushNotificationService(), pushNotificationService_exports));
      await notifyDailyFreePredictionReady2();
      res.json({ success: true, message: "Push notification sent to all registered devices" });
    } catch (error) {
      console.error("Send notification error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.delete("/api/notifications/clear-tokens", requireAdmin, adminRateLimit, async (_req, res) => {
    try {
      const { clearAllPushTokens: clearAllPushTokens2 } = await Promise.resolve().then(() => (init_pushNotificationService(), pushNotificationService_exports));
      const count = await clearAllPushTokens2();
      res.json({ success: true, message: `Cleared ${count} push tokens` });
    } catch (error) {
      console.error("Clear tokens error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/refresh-history", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      await forceRefreshHistory();
      const history = await getHistoryPredictions();
      res.json({ success: true, count: history.length });
    } catch (error) {
      console.error("Refresh history error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/refresh-premium-history", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const history = await getHistoryPredictions(void 0, true);
      res.json({ success: true, premiumHistoryCount: history.length });
    } catch (error) {
      console.error("Refresh premium history error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/reset-premature", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const now = /* @__PURE__ */ new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1e3);
      const result = await db.update(predictions).set({ result: sql5`null`, explanation: sql5`null` }).where(
        and2(
          sql5`${predictions.result} IS NOT NULL`,
          sql5`${predictions.matchTime} >= ${threeHoursAgo.toISOString()}::timestamp`,
          sql5`${predictions.expiresAt} > ${predictions.matchTime}`
        )
      ).returning({ id: predictions.id, matchTitle: predictions.matchTitle });
      res.json({ success: true, reset: result.length, predictions: result });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/add-history", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const parsed = addHistorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const entries = parsed.data.entries;
      let inserted = 0;
      for (const e of entries) {
        const isPremium = e.isPremium === true;
        const expiresAt = e.expiresAt || e.matchTime;
        await db.execute(sql5`
          INSERT INTO predictions (user_id, match_title, sport, match_time, predicted_outcome, probability, confidence, explanation, factors, sportsbook_odds, risk_index, is_live, is_premium, result, created_at, expires_at)
          VALUES (NULL, ${e.matchTitle}, ${e.sport}, ${e.matchTime}::timestamp, ${e.predictedOutcome}, ${e.probability}, ${e.confidence}, ${e.explanation}, ${JSON.stringify(e.factors || [])}::jsonb, ${JSON.stringify(e.sportsbookOdds || {})}::jsonb, ${e.riskIndex || 5}, false, ${isPremium}, 'correct', ${e.matchTime}::timestamp, ${expiresAt}::timestamp)
          ON CONFLICT DO NOTHING
        `);
        inserted++;
      }
      res.json({ success: true, inserted });
    } catch (error) {
      console.error("Add history error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/fix-migrated-entries", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const parsed = fixMigratedSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const ids = parsed.data.ids;
      const idList = ids.map((id) => sql5`${id}`).reduce((a, b) => sql5`${a}, ${b}`);
      const result = await db.execute(sql5`
        UPDATE predictions
        SET is_premium = true,
            expires_at = match_time + INTERVAL '3 hours'
        WHERE id IN (${idList})
          AND user_id IS NULL
          AND result = 'correct'
      `);
      res.json({ success: true, updated: result.rowCount ?? ids.length });
    } catch (error) {
      console.error("Fix migrated entries error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.post("/api/predictions/cleanup-demos", requireAdmin, adminRateLimit, async (req, res) => {
    try {
      const markResult = await db.execute(sql5`
        UPDATE predictions 
        SET explanation = '[DEMO] ' || explanation
        WHERE explanation LIKE 'AI analysis suggests%'
        AND explanation NOT LIKE '[DEMO]%'
        AND is_premium = true
        AND user_id IS NULL
      `);
      const marked = markResult.rowCount || 0;
      const dupeResult = await db.execute(sql5`
        DELETE FROM predictions
        WHERE id NOT IN (
          SELECT MIN(id) FROM predictions
          WHERE is_premium = true AND user_id IS NULL AND result IS NULL
          GROUP BY match_title
        )
        AND is_premium = true AND user_id IS NULL AND result IS NULL
      `);
      const removed = dupeResult.rowCount || 0;
      res.json({ success: true, marked, duplicatesRemoved: removed });
    } catch (error) {
      console.error("Cleanup demos error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.get("/api/user/preferences/:userId", optionalAuth, apiReadRateLimit, async (req, res) => {
    try {
      const userId = req.params.userId;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || { notificationsEnabled: true });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const preferencesSchema = z.object({
    userId: z.string().optional(),
    notificationsEnabled: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    predictionAlerts: z.boolean().optional(),
    language: z.string().optional()
  });
  app2.post("/api/user/preferences", optionalAuth, apiWriteRateLimit, async (req, res) => {
    try {
      const userId = req.userId ?? req.body.userId;
      if (!userId) return res.status(401).json({ error: "userId required" });
      const parsed = preferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { userId: _uid, ...prefsOnly } = parsed.data;
      const preferences = await storage.saveUserPreferences(userId, prefsOnly);
      res.json(preferences);
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const pushTokenSchema = z.object({
    userId: z.string().optional(),
    token: z.string().min(1).max(500).regex(/^ExponentPushToken\[.+\]$|^[a-zA-Z0-9_:.\-]+$/, "Invalid push token format"),
    platform: z.enum(["ios", "android", "web", "unknown"]).optional()
  });
  app2.post("/api/push-token", optionalAuth, apiWriteRateLimit, async (req, res) => {
    try {
      const userId = req.userId ?? req.body.userId;
      if (!userId) return res.status(401).json({ error: "userId required" });
      const parsed = pushTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid push token" });
      }
      const { registerPushToken: registerPushToken2 } = await Promise.resolve().then(() => (init_pushNotificationService(), pushNotificationService_exports));
      await registerPushToken2(userId, parsed.data.token, parsed.data.platform || "unknown");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  app2.delete("/api/push-token", optionalAuth, apiWriteRateLimit, async (req, res) => {
    try {
      const userId = req.userId ?? req.body.userId;
      if (!userId) return res.status(401).json({ error: "userId required" });
      const parsed = z.object({ userId: z.string().optional(), token: z.string().min(1).max(500) }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid push token" });
      }
      const { removePushTokenForUser: removePushTokenForUser2 } = await Promise.resolve().then(() => (init_pushNotificationService(), pushNotificationService_exports));
      await removePushTokenForUser2(parsed.data.token, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const restoreRateLimit = rateLimit({ windowMs: 60 * 1e3, max: 3 });
  app2.post("/api/restore-purchases", optionalAuth, restoreRateLimit, async (req, res) => {
    try {
      const userId = req.userId ?? req.body.userId;
      if (!userId) return res.status(401).json({ error: "userId required" });
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (!user.stripeCustomerId) {
        return res.json({ restored: false, message: "No purchases found" });
      }
      const subscription = await stripeService.getActiveSubscription(user.stripeCustomerId);
      if (subscription && subscription.status === "active") {
        const expiryDate = new Date(subscription.current_period_end * 1e3);
        const restoreUpdate = {
          stripeSubscriptionId: subscription.id,
          isPremium: true,
          subscriptionExpiry: expiryDate
        };
        if (!user.isPremium) {
          restoreUpdate.premiumSince = /* @__PURE__ */ new Date();
        }
        await storage.updateUserStripeInfo(userId, restoreUpdate);
        return res.json({ restored: true, message: "Subscription restored successfully" });
      }
      return res.json({ restored: false, message: "No active subscriptions found" });
    } catch (error) {
      console.error("Error restoring purchases:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });
  const contactSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(254),
    subject: z.string().min(1).max(200),
    message: z.string().min(10).max(5e3)
  });
  app2.post("/api/contact", contactRateLimit, async (req, res) => {
    try {
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { name, email, subject, message } = parsed.data;
      const submission = await storage.createContactSubmission({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim()
      });
      console.log(`Contact form submission from ${email}: [${subject}]`);
      return res.json({ success: true, id: submission.id });
    } catch (error) {
      console.error("Contact form error:", error);
      return res.status(500).json({ error: "Failed to save message. Please try again." });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/webhookHandlers.ts
init_db();
init_schema();
import { eq as eq3 } from "drizzle-orm";
var WebhookHandlers = class {
  static async activatePremiumForUser(user, subscriptionId, periodEnd) {
    const expiryDate = periodEnd ? new Date(periodEnd * 1e3) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
    const premiumUpdate = {
      isPremium: true,
      stripeSubscriptionId: subscriptionId,
      subscriptionExpiry: expiryDate
    };
    if (!user.isPremium) {
      premiumUpdate.premiumSince = /* @__PURE__ */ new Date();
    }
    await storage.updateUserStripeInfo(user.id, premiumUpdate);
    console.log(`Premium activated for user ${user.id} until ${expiryDate.toISOString()}`);
    await generatePremiumPredictionsForUser(user.id);
    console.log(`Premium predictions generated for user ${user.id}`);
  }
  static async processWebhook(payload, signature) {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. Received type: " + typeof payload + ". This usually means express.json() parsed the body before reaching this handler. FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
    try {
      const event = JSON.parse(payload.toString());
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        if (session.mode === "subscription" && session.customer && session.subscription) {
          const user = await storage.getUserByStripeCustomerId(session.customer);
          if (user && !user.isPremium) {
            console.log(`Checkout completed for user ${user.id}, activating premium...`);
            try {
              const stripe = await getUncachableStripeClient();
              const sub = await stripe.subscriptions.retrieve(session.subscription);
              await this.activatePremiumForUser(user, sub.id, sub.current_period_end);
            } catch (subErr) {
              await this.activatePremiumForUser(user, session.subscription);
            }
          }
        }
      }
      if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          if (subscription.status === "active") {
            console.log(`Subscription ${event.type} (active) for user ${user.id}`);
            await this.activatePremiumForUser(user, subscription.id, subscription.current_period_end);
          } else if (["canceled", "unpaid", "past_due", "incomplete_expired"].includes(subscription.status)) {
            console.log(`Subscription ${subscription.status} for user ${user.id}, removing premium access...`);
            await storage.updateUserStripeInfo(user.id, {
              isPremium: false,
              stripeSubscriptionId: void 0,
              subscriptionExpiry: void 0
            });
            console.log(`Premium access removed for user ${user.id}`);
          }
        }
      }
      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          console.log(`Payment failed for user ${user.id} (invoice ${invoice.id}, attempt ${invoice.attempt_count})`);
          if (invoice.attempt_count >= 3) {
            await storage.updateUserStripeInfo(user.id, {
              isPremium: false
            });
            console.log(`Premium revoked for user ${user.id} after ${invoice.attempt_count} failed payment attempts`);
          }
        }
      }
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          console.log(`Subscription deleted for user ${user.id}, removing premium access...`);
          await storage.updateUserStripeInfo(user.id, {
            isPremium: false,
            stripeSubscriptionId: void 0,
            subscriptionExpiry: void 0
          });
          console.log(`Premium access removed for user ${user.id}`);
        }
      }
    } catch (error) {
      console.error("Error processing subscription webhook for predictions:", error);
    }
  }
  static async processAffiliateReferral(userId, subscription) {
    try {
      const [user] = await db.select().from(users).where(eq3(users.id, userId));
      if (!user || !user.referredByCode) return;
      const [affiliate] = await db.select().from(affiliates).where(eq3(affiliates.affiliateCode, user.referredByCode));
      if (!affiliate || !affiliate.isActive) {
        console.log(`Affiliate not found or inactive for code: ${user.referredByCode}`);
        return;
      }
      const existingReferral = await db.select().from(referrals).where(eq3(referrals.referredUserId, userId));
      if (existingReferral.length > 0) {
        console.log(`Referral already exists for user: ${userId}`);
        return;
      }
      const subscriptionAmount = subscription.items?.data?.[0]?.price?.unit_amount || 4900;
      const commissionRate = affiliate.commissionRate || 40;
      const commissionAmount = Math.floor(subscriptionAmount * (commissionRate / 100));
      await db.insert(referrals).values({
        affiliateId: affiliate.id,
        referredUserId: userId,
        subscriptionId: subscription.id,
        subscriptionAmount,
        commissionAmount,
        status: "pending"
      });
      await db.update(affiliates).set({
        totalEarnings: (affiliate.totalEarnings || 0) + commissionAmount,
        pendingEarnings: (affiliate.pendingEarnings || 0) + commissionAmount,
        totalReferrals: (affiliate.totalReferrals || 0) + 1
      }).where(eq3(affiliates.id, affiliate.id));
      console.log(`Stripe affiliate referral: ${affiliate.affiliateCode} earned $${(commissionAmount / 100).toFixed(2)}`);
    } catch (error) {
      console.error("Error processing Stripe affiliate referral:", error);
    }
  }
  // Handles affiliate commission for RevenueCat (native iOS/Android) purchases.
  // Uses referredUserId as the dedup key — affiliates earn for the first subscription only.
  static async processAffiliateReferralForRevenueCat(userId, productId) {
    try {
      const [user] = await db.select().from(users).where(eq3(users.id, userId));
      if (!user || !user.referredByCode) return;
      const [affiliate] = await db.select().from(affiliates).where(eq3(affiliates.affiliateCode, user.referredByCode));
      if (!affiliate || !affiliate.isActive) {
        console.log(`RevenueCat affiliate: not found or inactive for code ${user.referredByCode}`);
        return;
      }
      const existingReferral = await db.select().from(referrals).where(eq3(referrals.referredUserId, userId));
      if (existingReferral.length > 0) {
        console.log(`RevenueCat affiliate: referral already exists for user ${userId}`);
        return;
      }
      const isAnnual = String(productId || "").toLowerCase().includes("annual");
      const subscriptionAmount = isAnnual ? 14900 : 4999;
      const commissionRate = affiliate.commissionRate || 40;
      const commissionAmount = Math.floor(subscriptionAmount * (commissionRate / 100));
      await db.insert(referrals).values({
        affiliateId: affiliate.id,
        referredUserId: userId,
        subscriptionId: `rc_${userId}_${productId}`,
        subscriptionAmount,
        commissionAmount,
        status: "pending"
      });
      await db.update(affiliates).set({
        totalEarnings: (affiliate.totalEarnings || 0) + commissionAmount,
        pendingEarnings: (affiliate.pendingEarnings || 0) + commissionAmount,
        totalReferrals: (affiliate.totalReferrals || 0) + 1
      }).where(eq3(affiliates.id, affiliate.id));
      console.log(`RevenueCat affiliate referral: ${affiliate.affiliateCode} earned $${(commissionAmount / 100).toFixed(2)} (${isAnnual ? "annual" : "monthly"}) for user ${userId}`);
    } catch (error) {
      console.error("Error processing RevenueCat affiliate referral:", error);
    }
  }
};

// server/index.ts
init_db();
init_schema();
import * as fs3 from "fs";
import * as path3 from "path";
import * as bcrypt2 from "bcryptjs";
import { eq as eq4 } from "drizzle-orm";
var app = express2();
var log = console.log;
async function seedTestUser() {
  try {
    const TEST_EMAIL = "test@probaly.app";
    const TEST_PASSWORD = "testpass123";
    const PREMIUM_EXPIRY = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1e3);
    const existing = await db.select().from(users).where(eq4(users.email, TEST_EMAIL)).limit(1);
    if (existing.length === 0) {
      const hashedPassword = await bcrypt2.hash(TEST_PASSWORD, 10);
      await db.insert(users).values({
        email: TEST_EMAIL,
        password: hashedPassword,
        name: "Probaly Tester",
        isPremium: true,
        premiumSince: /* @__PURE__ */ new Date(),
        subscriptionExpiry: PREMIUM_EXPIRY
      });
      log(`\u2713 Test user created with premium: ${TEST_EMAIL}`);
    } else {
      await db.update(users).set({ isPremium: true, subscriptionExpiry: PREMIUM_EXPIRY, name: "Probaly Tester", premiumSince: existing[0].premiumSince || /* @__PURE__ */ new Date() }).where(eq4(users.email, TEST_EMAIL));
      log(`\u2713 Test user premium access refreshed: ${TEST_EMAIL}`);
    }
    const FREE_EMAIL = "review@probaly.app";
    const FREE_PASSWORD = "reviewpass123";
    const existingFree = await db.select().from(users).where(eq4(users.email, FREE_EMAIL)).limit(1);
    if (existingFree.length === 0) {
      const hashedFreePassword = await bcrypt2.hash(FREE_PASSWORD, 10);
      await db.insert(users).values({
        email: FREE_EMAIL,
        password: hashedFreePassword,
        name: "App Reviewer",
        isPremium: false
      });
      log(`\u2713 Free review account created: ${FREE_EMAIL}`);
    } else {
      await db.update(users).set({ name: "App Reviewer" }).where(eq4(users.email, FREE_EMAIL));
      log(`\u2713 Free review account verified: ${FREE_EMAIL}`);
    }
  } catch (error) {
  }
}
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("DATABASE_URL not set, skipping Stripe initialization");
    return;
  }
  try {
    log("Initializing Stripe schema...");
    await runMigrations({
      databaseUrl,
      schema: "stripe"
    });
    log("Stripe schema ready");
    const stripeSync2 = await getStripeSync();
    log("Setting up managed webhook...");
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const webhookResult = await stripeSync2.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    log(`Webhook configured: ${webhookResult?.webhook?.url || "Webhook URL pending"}`);
    log("Webhook setup complete");
    log("Syncing Stripe data in background...");
    stripeSync2.syncBackfill().then(() => {
      log("Stripe data synced");
    }).catch((err) => {
      console.error("Error syncing Stripe data:", err);
    });
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}
function setupSecurityHeaders(app2) {
  app2.use((req, res, next) => {
    res.header("X-Content-Type-Options", "nosniff");
    res.header("X-Frame-Options", "DENY");
    res.header("X-XSS-Protection", "0");
    res.header("Referrer-Policy", "strict-origin-when-cross-origin");
    res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.REPLIT_DEPLOYMENT === "1") {
      res.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    if (req.path.startsWith("/api")) {
      res.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.header("Pragma", "no-cache");
    }
    next();
  });
}
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    origins.add("https://probaly.net");
    const origin = req.header("origin");
    const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || !isProduction && isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path4 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path4.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path3.resolve(process.cwd(), "app.json");
    const appJsonContent = fs3.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path3.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs3.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs3.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const distPath = path3.resolve(process.cwd(), "dist");
  const webBuildExists = fs3.existsSync(path3.join(distPath, "index.html"));
  log(`Serving ${webBuildExists ? "web app from dist/" : "Expo landing page"}`);
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    next();
  });
  app2.use("/assets", express2.static(path3.resolve(process.cwd(), "assets")));
  app2.get("/google5558d3209820d790.html", (_req, res) => {
    const verifyPath = path3.resolve(process.cwd(), "server", "templates", "google5558d3209820d790.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(verifyPath);
  });
  app2.get("/yandex_6b694df7940e1f88.html", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      '<html>\n    <head>\n        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n    </head>\n    <body>Verification: 6b694df7940e1f88</body>\n</html>'
    );
  });
  app2.get("/robots.txt", (_req, res) => {
    const robotsPath = path3.resolve(process.cwd(), "server", "templates", "robots.txt");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(robotsPath);
  });
  app2.get("/sitemap.xml", (_req, res) => {
    const sitemapPath = path3.resolve(process.cwd(), "server", "templates", "sitemap.xml");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(sitemapPath);
  });
  app2.get("/contact", (_req, res) => {
    const contactPath = path3.resolve(process.cwd(), "server", "templates", "contact.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(contactPath);
  });
  app2.get("/privacy-policy", (_req, res) => {
    const policyPath = path3.resolve(process.cwd(), "server", "templates", "privacy-policy.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(policyPath);
  });
  app2.get("/privacypolicy", (_req, res) => {
    res.redirect(301, "/privacy-policy");
  });
  app2.get("/terms", (_req, res) => {
    const termsPath = path3.resolve(process.cwd(), "server", "templates", "terms.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(termsPath);
  });
  for (const alias of [
    "/term",
    "/termsofservice",
    "/terms-of-service",
    "/termsandconditions",
    "/terms-and-conditions"
  ]) {
    app2.get(alias, (_req, res) => {
      res.redirect(301, "/terms");
    });
  }
  app2.get("/checkout/success", (_req, res) => {
    const successPath = path3.resolve(process.cwd(), "server", "templates", "checkout-success.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(successPath);
  });
  app2.get("/checkout/cancel", (_req, res) => {
    const cancelPath = path3.resolve(process.cwd(), "server", "templates", "checkout-cancel.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(cancelPath);
  });
  const templatePath = path3.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs3.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  app2.get("/", (req, res) => {
    serveLandingPage({ req, res, landingPageTemplate, appName });
  });
  if (webBuildExists) {
    const serveWebApp = (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.sendFile(path3.join(distPath, "index.html"));
    };
    app2.get("/app", serveWebApp);
    app2.get("/app/*path", serveWebApp);
    app2.use(express2.static(distPath, { index: false, maxAge: "7d" }));
  }
  app2.use(express2.static(path3.resolve(process.cwd(), "static-build"), { index: false }));
  const landingPagePaths = /* @__PURE__ */ new Set([
    "/",
    "/contact",
    "/privacypolicy",
    "/privacy-policy",
    "/terms",
    "/terms-of-service",
    "/termsofservice",
    "/checkout/success",
    "/checkout/cancel"
  ]);
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads/")) {
      return next();
    }
    if (webBuildExists && !landingPagePaths.has(req.path)) {
      return res.sendFile(path3.join(distPath, "index.html"));
    }
    serveLandingPage({ req, res, landingPageTemplate, appName });
  });
  log("Serving app download landing page");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  await initStripe();
  setupSecurityHeaders(app);
  setupCors(app);
  app.post(
    "/api/stripe/webhook",
    express2.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature" });
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) {
          console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer.");
          return res.status(500).json({ error: "Webhook processing error" });
        }
        await WebhookHandlers.processWebhook(req.body, sig);
        res.status(200).json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error.message);
        res.status(400).json({ error: "Webhook processing error" });
      }
    }
  );
  app.use(
    express2.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app.use(express2.urlencoded({ extended: false }));
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  try {
    const { initTelegramService: initTelegramService2, disconnectTelegramClient: disconnectTelegramClient2 } = await Promise.resolve().then(() => (init_telegramService(), telegramService_exports));
    await initTelegramService2(app);
    process.on("SIGTERM", () => {
      void disconnectTelegramClient2().finally(() => process.exit(0));
    });
  } catch (err) {
    log(`Telegram service init failed (continuing): ${err.message}`);
  }
  setupErrorHandler(app);
  try {
    const { sql: sql7 } = await import("drizzle-orm");
    await db.execute(sql7`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0
    `);
    log("Ensured users.token_version column exists");
  } catch (err) {
    log(`FATAL: token_version migration failed: ${err.message}`);
    throw err;
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    async () => {
      log(`express server serving on port ${port}`);
      await seedTestUser();
      try {
        const { predictions: predictions2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
        const deleted = await db.delete(predictions2).where(eq4(predictions2.id, 4113)).returning();
        if (deleted.length > 0) log(`Removed prediction ID 4113 (${deleted[0].matchTitle}) from DB`);
      } catch {
      }
      try {
        const { sql: sql7 } = await import("drizzle-orm");
        const result = await db.execute(sql7`
          UPDATE predictions
          SET explanation = SUBSTRING(explanation FROM 8)
          WHERE explanation LIKE '[DEMO] %'
        `);
        const updated = result?.rowCount ?? result?.count ?? 0;
        if (updated > 0) log(`Stripped [DEMO] prefix from ${updated} prediction(s)`);
      } catch (err) {
        log(`[DEMO] cleanup skipped: ${err.message}`);
      }
      const { initPushTokensTable: initPushTokensTable2 } = await Promise.resolve().then(() => (init_pushNotificationService(), pushNotificationService_exports));
      await initPushTokensTable2();
      startDailyRefreshScheduler();
    }
  );
})();
