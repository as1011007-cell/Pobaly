import express, { type Express, type Request, type Response } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { db } from "../db";
import { sql } from "drizzle-orm";

const UPLOAD_DIR = path.resolve(process.cwd(), "server", "uploads", "telegram");
const PUBLIC_PREFIX = "/uploads/telegram";
// Static "winnings" gallery shown at the END of the landing-page slider,
// always after the live Telegram items. Read once at startup from disk
// (server/uploads/fallback/) and cached — these files don't change at
// runtime, so no need to rescan.
const FALLBACK_DIR = path.resolve(process.cwd(), "server", "uploads", "fallback");
const FALLBACK_PREFIX = "/uploads/fallback";
const MAX_DISPLAY_ITEMS = 3;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const ROTATION_CHECK_INTERVAL_MS = 60 * 1000;
// Poll Telegram every 90 seconds to catch missed messages (reliable fallback
// when the persistent MTProto event handler drops silently in production).
// Also serves as the self-healing reconnect cycle: a broken connection
// recovers within ~90 seconds rather than the previous 5-minute window.
const POLL_INTERVAL_MS = 90 * 1000;
// First poll runs 45 seconds after server start — strictly LONGER than
// CONNECT_TIMEOUT_MS (30s) so the initial startTelegramListener call from
// initTelegramService has already either succeeded or timed-out before the
// poll's reconnect path can race with it. Without this gap, two concurrent
// TelegramClient instances would negotiate with the same session string,
// triggering AUTH_KEY_DUPLICATED.
const FIRST_POLL_DELAY_MS = 45 * 1000;
const ROTATION_HOUR_ET = 11; // 11:00 America/New_York
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const INVITE_HASH = process.env.TELEGRAM_INVITE_HASH || "5uZNUktfpeZiMjVi";
// Hard timeout for individual gramjs API calls after connect() succeeds.
// gramjs's _updateLoop can die silently mid-handshake, leaving subsequent
// invokes (isUserAuthorized, ImportChatInvite, etc.) hanging forever with no
// error. Without this, isConnecting would stay true forever and polling
// would deadlock with "connect already in flight, deferring..."
const GRAMJS_CALL_TIMEOUT_MS = 15_000;
// If isConnecting has been true longer than this, polling treats the lock
// as stale (the in-flight startTelegramListener has hung) and forces a
// reset. Must be larger than CONNECT_TIMEOUT_MS + 3*GRAMJS_CALL_TIMEOUT_MS
// (worst-case healthy startTelegramListener duration) plus headroom.
const STALE_CONNECTING_MS = 90_000;
// Tracks when isConnecting was last set to true. Used by pollForNewMedia
// to detect a stuck in-flight connect attempt.
let isConnectingSince: number | null = null;
// Exponential backoff state to protect the Telegram session from being
// flagged. After repeated reconnect failures we wait progressively longer
// between attempts so Telegram only ever sees a slow trickle of connect
// requests, never a storm. Reset to 0 on the first successful reconnect.
let consecutiveConnectFailures = 0;
let nextAllowedConnectAt = 0; // ms epoch; 0 = no wait
function backoffDelayForFailures(n: number): number {
  // Failures 1-2: no extra delay — rely on POLL_INTERVAL_MS (90s) so a
  //   single transient hiccup recovers fast.
  // Failure 3: 5 min — start spacing things out.
  // Failure 4: 15 min — Telegram is clearly unhappy; back off harder.
  // Failure 5: 30 min — long cool-down to let any flag clear.
  // Failure 6: 1 hour — at this point the session is almost certainly
  //   blacklisted at the MTProto layer (TCP connects succeed but
  //   isUserAuthorized hangs silently). No point in hammering.
  // Failure 7: 2 hours.
  // Failure 8: 4 hours.
  // Failure 9+: 6 hours (capped) — wait out any temporary flag while
  //   the operator regenerates TELEGRAM_SESSION_STRING.
  if (n <= 2) return 0;
  if (n === 3) return 5 * 60 * 1000;
  if (n === 4) return 15 * 60 * 1000;
  if (n === 5) return 30 * 60 * 1000;
  if (n === 6) return 60 * 60 * 1000;
  if (n === 7) return 2 * 60 * 60 * 1000;
  if (n === 8) return 4 * 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}
// Timeout for the initial client.connect() call (ms). If Telegram doesn't
// respond within this window we give up and retry on the next poll cycle.
const CONNECT_TIMEOUT_MS = 30_000;

// true once the event handler is registered (prevents double-registration)
let listenerStarted = false;
// true while a connect attempt is in progress (prevents concurrent retries)
let isConnecting = false;
let resolvedChannelId: bigint | null = null;
let lastRotationDateET: string | null = null;
// Stored after a successful connect so the polling interval can reuse them.
let telegramClient: any = null;
let telegramApiRef: any = null;

async function ensureTable() {
  await db.execute(sql`
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
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_telegram_media_expires_at ON telegram_media(expires_at)
  `);
  // Daily display rotation: items become visible only after a 11 AM ET tick
  // marks them active. Adding the column idempotently lets older rows live
  // until the next rotation picks them up.
  await db.execute(sql`
    ALTER TABLE telegram_media ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_telegram_media_activated_at ON telegram_media(activated_at)
  `);
}

function todayInET(): string {
  // YYYY-MM-DD in America/New_York
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function currentHourInET(): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  });
  // formatToParts is more reliable than format() across Node versions
  const parts = fmt.formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n; // some locales render midnight as "24"
}

async function rotateDailyDisplay(): Promise<number> {
  // Activate the 3 newest items (by post time) as the visible set for the
  // next 24 hours. Updating expires_at to NOW() + 24h means activated items
  // survive the cleanup sweep until the next rotation, even if their
  // original 24h post-time window has elapsed. Returns the number of rows
  // activated; -1 indicates a DB error so callers can retry on the next tick.
  try {
    const result: any = await db.execute(sql`
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
    const rows: any[] = result.rows || result || [];
    console.log(
      `[telegram] rotation activated ${rows.length} item(s) for the next 24h`,
    );
    return rows.length;
  } catch (e) {
    console.warn("[telegram] rotation failed:", (e as Error).message);
    return -1;
  }
}

async function checkRotation() {
  try {
    const dateET = todayInET();
    const hourET = currentHourInET();
    // Run as soon as we cross 11 AM ET (or any time after, on the same ET
    // day, if we haven't rotated yet — covers restarts later in the day).
    if (hourET >= ROTATION_HOUR_ET && lastRotationDateET !== dateET) {
      const n = await rotateDailyDisplay();
      // Only mark today as "done" if rotation actually activated rows; that
      // way a transient DB error or an empty table (still being backfilled)
      // gets retried on the next 60s tick.
      if (n > 0) lastRotationDateET = dateET;
    }
  } catch (e) {
    console.warn("[telegram] rotation check failed:", (e as Error).message);
  }
}

async function ensureInitialRotation() {
  // If there are no items currently in the active display set, do a one-off
  // rotation so the gallery isn't empty after a fresh deploy or a long
  // server downtime. This may run before 11 AM ET — we still need that
  // day's normal 11 AM tick, so only mark today "done" when we both
  // activated rows AND are already past the 11 AM threshold; otherwise
  // leave lastRotationDateET = null so checkRotation runs on schedule.
  try {
    const result: any = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM telegram_media
      WHERE activated_at IS NOT NULL AND expires_at > NOW()
    `);
    const rows: any[] = result.rows || result || [];
    const n = Number(rows[0]?.n ?? 0);
    if (n === 0) {
      console.log(
        "[telegram] no active display items found — running initial rotation",
      );
      const activated = await rotateDailyDisplay();
      if (activated > 0 && currentHourInET() >= ROTATION_HOUR_ET) {
        lastRotationDateET = todayInET();
      }
    }
  } catch (e) {
    console.warn(
      "[telegram] initial rotation check failed:",
      (e as Error).message,
    );
  }
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function cleanupExpired() {
  try {
    // Delete expired rows first (DB is the source of truth) and get the
    // file_paths back so we can unlink — this avoids orphaned DB rows if a
    // file unlink fails.
    //
    // Safety: NEVER delete the latest MAX_DISPLAY_ITEMS by post time, even
    // if their expires_at has passed. The landing page renders these as
    // "latest 3 from the channel" — we must not lose them just because
    // rotation didn't refresh their expires_at on schedule (e.g., during
    // a Telegram outage or extended period of no new posts).
    const result: any = await db.execute(sql`
      DELETE FROM telegram_media
      WHERE expires_at <= NOW()
        AND id NOT IN (
          SELECT id FROM telegram_media
          ORDER BY created_at DESC, id DESC
          LIMIT ${MAX_DISPLAY_ITEMS}
        )
      RETURNING file_path
    `);
    const rows: any[] = result.rows || result || [];
    for (const row of rows) {
      const filePath = path.join(UPLOAD_DIR, row.file_path);
      try {
        await fs.unlink(filePath);
      } catch {
        // file may already be gone — fine
      }
    }
    if (rows.length > 0) {
      console.log(`[telegram] cleanup removed ${rows.length} expired item(s)`);
    }

    // Disk sweep: unlink any files in the upload dir that are not referenced
    // by an active DB row. Skip files modified within the last 5 minutes so
    // we never race against an in-flight ingest (writeFile happens just
    // before the INSERT — that brief window must not count as orphan).
    try {
      const onDisk = await fs.readdir(UPLOAD_DIR);
      if (onDisk.length > 0) {
        const live: any = await db.execute(
          sql`SELECT file_path FROM telegram_media`,
        );
        const liveRows: any[] = live.rows || live || [];
        const liveSet = new Set<string>(liveRows.map((r: any) => r.file_path));
        const graceMs = 5 * 60 * 1000;
        const now = Date.now();
        let orphans = 0;
        for (const name of onDisk) {
          if (liveSet.has(name)) continue;
          try {
            const stat = await fs.stat(path.join(UPLOAD_DIR, name));
            if (now - stat.mtimeMs < graceMs) continue;
            await fs.unlink(path.join(UPLOAD_DIR, name));
            orphans++;
          } catch {
            // file might have been deleted between readdir and stat — ignore
          }
        }
        if (orphans > 0) {
          console.log(`[telegram] disk sweep removed ${orphans} orphan file(s)`);
        }
      }
    } catch {
      // upload dir might not exist yet — ignore
    }
  } catch (e) {
    console.warn("[telegram] cleanup failed:", (e as Error).message);
  }
}

// Cached at startup. Each entry mirrors the shape returned by getActiveMedia
// so the slider renders them with the exact same code path.
let fallbackItems: Array<{
  id: string;
  type: "photo" | "video";
  url: string;
  mimeType: string | null;
  width: null;
  height: null;
  caption: null;
  createdAt: null;
  expiresAt: null;
}> = [];

async function loadFallbackItems() {
  try {
    await fs.mkdir(FALLBACK_DIR, { recursive: true });
    const names = (await fs.readdir(FALLBACK_DIR))
      .filter((n) => /\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i.test(n))
      .sort();
    fallbackItems = names.map((name) => {
      const lower = name.toLowerCase();
      const isVideo = /\.(mp4|mov|webm)$/i.test(lower);
      const mime =
        lower.endsWith(".mp4") ? "video/mp4" :
        lower.endsWith(".mov") ? "video/quicktime" :
        lower.endsWith(".webm") ? "video/webm" :
        lower.endsWith(".png") ? "image/png" :
        lower.endsWith(".webp") ? "image/webp" :
        lower.endsWith(".gif") ? "image/gif" :
        "image/jpeg";
      return {
        id: `fallback-${name}`,
        type: (isVideo ? "video" : "photo") as "photo" | "video",
        url: `${FALLBACK_PREFIX}/${name}`,
        mimeType: mime,
        width: null,
        height: null,
        caption: null,
        createdAt: null,
        expiresAt: null,
      };
    });
    console.log(`[telegram] loaded ${fallbackItems.length} fallback gallery items`);
  } catch (e) {
    console.warn("[telegram] failed to load fallback items:", (e as Error).message);
    fallbackItems = [];
  }
}

async function getActiveMedia() {
  // Always return the latest MAX_DISPLAY_ITEMS by post time. We deliberately
  // do NOT filter by activated_at or expires_at — the landing page must
  // always reflect the 3 newest posts in the channel as soon as they're
  // ingested, regardless of whether the rotation logic has run yet. The
  // rotation/activation flow still updates expires_at to protect rows from
  // cleanup; this query just doesn't depend on it for visibility.
  const result: any = await db.execute(sql`
    SELECT id, telegram_message_id, media_type, file_path, mime_type,
           width, height, caption, created_at, expires_at
    FROM telegram_media
    ORDER BY created_at DESC, id DESC
    LIMIT ${MAX_DISPLAY_ITEMS}
  `);
  const rows: any[] = result.rows || result || [];
  return rows.map((r: any) => ({
    id: r.id,
    type: r.media_type,
    url: `${PUBLIC_PREFIX}/${r.file_path}`,
    mimeType: r.mime_type,
    width: r.width,
    height: r.height,
    caption: r.caption,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));
}

async function ingestMessage(
  client: any,
  msg: any,
  Api: any,
): Promise<boolean> {
  const messageId = BigInt(msg.id);
  const media = msg.media;
  let mediaType: "photo" | "video" | null = null;
  let mimeType: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let ext = "bin";
  let sizeBytes = 0;

  const className = media?.className || "";

  if (className === "MessageMediaPhoto" || media instanceof Api.MessageMediaPhoto) {
    mediaType = "photo";
    mimeType = "image/jpeg";
    ext = "jpg";
    const photo = media.photo;
    const sizes: any[] = photo?.sizes || [];
    let largest: any = null;
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
      const va = doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo");
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
      `[telegram] skipping message ${messageId} — too large (${sizeBytes} bytes)`,
    );
    return false;
  }

  const existing: any = await db.execute(sql`
    SELECT id FROM telegram_media WHERE telegram_message_id = ${messageId.toString()} LIMIT 1
  `);
  const existingRows: any[] = existing.rows || existing || [];
  if (existingRows.length > 0) return false;

  // Use the message's actual post time so backfilled items expire 24h after
  // they were posted (not 24h after we ingested them).
  const postedAtSecs = Number(msg.date || 0) || Math.floor(Date.now() / 1000);
  const ageMs = Date.now() - postedAtSecs * 1000;
  if (ageMs >= 24 * 60 * 60 * 1000) {
    // Already past the 24h display window — skip download entirely.
    return false;
  }

  const buffer: Buffer | undefined = await client.downloadMedia(msg, {});
  if (!buffer || !buffer.length) return false;

  const filename = `${postedAtSecs}_${messageId.toString()}.${ext}`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(fullPath, buffer);

  const caption = msg.message || null;
  try {
    const inserted: any = await db.execute(sql`
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
    const insertedRows: any[] = inserted.rows || inserted || [];
    if (insertedRows.length === 0) {
      // Row already existed (race) — drop the file we just wrote.
      try {
        await fs.unlink(fullPath);
      } catch {}
      return false;
    }
    console.log(
      `[telegram] ingested ${mediaType} message=${messageId} file=${filename} size=${sizeBytes}`,
    );
    return true;
  } catch (e) {
    // DB insert failed — clean up the orphan file we just wrote.
    try {
      await fs.unlink(fullPath);
    } catch {}
    throw e;
  }
}

// Returns the number of newly inserted rows (0 if nothing new / error).
async function backfillRecent(client: any, Api: any): Promise<number> {
  if (!resolvedChannelId) return 0;
  try {
    const peer = new Api.PeerChannel({ channelId: resolvedChannelId as any });
    const messages: any[] = await client.getMessages(peer, { limit: 30 });
    let newCount = 0;
    for (const m of messages) {
      if (!m?.media) continue;
      try {
        const wasNew = await ingestMessage(client, m, Api);
        if (wasNew) newCount++;
      } catch (err) {
        console.warn(
          "[telegram] backfill message failed:",
          (err as Error).message,
        );
      }
    }
    console.log(
      `[telegram] backfill checked ${messages.length} recent message(s), ${newCount} new`,
    );
    return newCount;
  } catch (e) {
    console.warn("[telegram] backfill failed:", (e as Error).message);
    return 0;
  }
}

// Race a promise against a timeout. gramjs invoke()s can hang silently
// (no error thrown) when the underlying _updateLoop has died — without an
// explicit timeout, await locks up forever. Throws Error("<label> timed
// out after Nms") on timeout.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// Reset listener state so the next pollForNewMedia call performs a full
// reconnect via startTelegramListener (which otherwise short-circuits when
// listenerStarted is true).
//
// IMPORTANT: When called via the normal path (isConnecting === false), we
// fully reset. When called while a connect is in-flight, callers in poll
// must use the stale-lock check first; this function bails to avoid racing.
async function resetTelegramState(reason: string) {
  if (isConnecting) {
    console.log(`[telegram] reset skipped (connect in flight): ${reason}`);
    return;
  }
  console.log(`[telegram] resetting state: ${reason}`);
  if (telegramClient) {
    try { await telegramClient.disconnect(); } catch {}
  }
  telegramClient = null;
  telegramApiRef = null;
  resolvedChannelId = null;
  listenerStarted = false;
  isConnectingSince = null;
}

// Polling fallback: runs every POLL_INTERVAL_MS. Self-healing — detects both
// "never connected" (initial setup failed) and "stale connection" (gramjs
// _updateLoop died silently) cases, and forces a clean reconnect by resetting
// all listener state. Once connected, pulls the latest 30 messages, ingests
// anything new, and rotates the gallery immediately if new items are found.
async function pollForNewMedia() {
  // Health check: client reference must exist AND gramjs must report it as
  // connected. After an _updateLoop TIMEOUT, gramjs sets `connected = false`
  // internally while our reference stays truthy — so checking the reference
  // alone is not enough.
  const clientConnected = (telegramClient as any)?.connected !== false;
  const clientHealthy =
    telegramClient && telegramApiRef && resolvedChannelId && clientConnected;

  if (!clientHealthy) {
    // Exponential backoff: if we've already failed too many times recently,
    // skip this cycle so Telegram doesn't see a storm of connect attempts
    // (which is what flags the session in the first place).
    const now = Date.now();
    if (now < nextAllowedConnectAt) {
      const waitS = Math.round((nextAllowedConnectAt - now) / 1000);
      console.log(
        `[telegram] poll: in backoff after ${consecutiveConnectFailures} consecutive failure(s), waiting ${waitS}s more before next reconnect`,
      );
      return;
    }
    // If a prior startTelegramListener is still negotiating, don't race with
    // it — let it finish, the next 90-second poll will pick up the result.
    // Safety net: if the lock has been held longer than STALE_CONNECTING_MS,
    // the in-flight call is hung (e.g., a gramjs invoke that never resolves);
    // force-clear the lock so this cycle can perform a fresh reconnect.
    if (isConnecting) {
      const heldFor = isConnectingSince ? Date.now() - isConnectingSince : 0;
      if (heldFor < STALE_CONNECTING_MS) {
        console.log(
          `[telegram] poll: connect already in flight (${Math.round(heldFor / 1000)}s), deferring to next cycle`,
        );
        return;
      }
      console.warn(
        `[telegram] poll: stale connect lock (${Math.round(heldFor / 1000)}s) — force-clearing and reconnecting`,
      );
      isConnecting = false;
      isConnectingSince = null;
    }
    const reason = !telegramClient
      ? "no client"
      : !telegramApiRef || !resolvedChannelId
      ? "incomplete setup"
      : "client disconnected";
    console.log(
      `[telegram] poll: client not ready (${reason}) — reconnecting (attempt after ${consecutiveConnectFailures} prior failure(s))...`,
    );
    await resetTelegramState(reason);
    await startTelegramListener();
    if (!telegramClient || !telegramApiRef || !resolvedChannelId) {
      consecutiveConnectFailures++;
      const backoffMs = backoffDelayForFailures(consecutiveConnectFailures);
      nextAllowedConnectAt = backoffMs > 0 ? Date.now() + backoffMs : 0;
      const nextS = backoffMs > 0
        ? `${Math.round(backoffMs / 1000)}s (backoff)`
        : `${Math.round(POLL_INTERVAL_MS / 1000)}s (next poll)`;
      console.log(
        `[telegram] poll: reconnect failed (#${consecutiveConnectFailures}). Next attempt in ${nextS}.`,
      );
      if (consecutiveConnectFailures >= 5) {
        console.warn(
          `[telegram] ACTION REQUIRED: ${consecutiveConnectFailures} consecutive failures — the session is almost certainly flagged at the MTProto layer (TCP connects but isUserAuthorized hangs). Regenerate TELEGRAM_SESSION_STRING via "npx tsx scripts/telegramLogin.ts" and update the secret. Until then we will retry only every few hours.`,
        );
      }
      return;
    }
    // Success — clear backoff so future failures start fresh.
    if (consecutiveConnectFailures > 0) {
      console.log(
        `[telegram] poll: reconnect succeeded after ${consecutiveConnectFailures} failure(s) — clearing backoff`,
      );
      consecutiveConnectFailures = 0;
      nextAllowedConnectAt = 0;
    }
  }
  try {
    console.log("[telegram] poll: checking for new media...");
    const newCount = await backfillRecent(telegramClient, telegramApiRef);
    if (newCount > 0) {
      console.log(`[telegram] poll: ${newCount} new item(s) — rotating gallery`);
      const n = await rotateDailyDisplay();
      if (n > 0 && currentHourInET() >= ROTATION_HOUR_ET) {
        lastRotationDateET = todayInET();
      }
    }
  } catch (e) {
    const errMsg = (e as Error).message || "";
    console.warn("[telegram] poll error:", errMsg);
    // If the API call failed because the underlying connection is dead, reset
    // state now so the next poll cycle performs a clean reconnect rather than
    // continuing to use the stale reference.
    if (
      errMsg.includes("TIMEOUT") ||
      errMsg.includes("Not connected") ||
      errMsg.includes("DISCONNECTED") ||
      errMsg.includes("closed") ||
      errMsg.includes("AUTH_KEY") ||
      (telegramClient as any)?.connected === false
    ) {
      await resetTelegramState(`api error: ${errMsg.slice(0, 80)}`);
    }
  }
}

async function startTelegramListener() {
  // Prevent duplicate event handler registration and concurrent connect attempts.
  if (listenerStarted || isConnecting) return;

  // Only run the persistent listener in production. In development the dev
  // server and production VM would both attempt to authenticate with the same
  // TELEGRAM_SESSION_STRING, causing Telegram to reject one (or both) with
  // AUTH_KEY_DUPLICATED. Keeping the listener production-only gives the VM
  // exclusive access to the session.
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[telegram] listener skipped in development mode (runs in production only)",
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
      "[telegram] secrets not configured — listener disabled (polling-only mode)",
    );
    isConnecting = false;
    isConnectingSince = null;
    return;
  }

  console.log("[telegram] starting listener, apiId present, importing gramjs...");

  try {
    // Use explicit "/index.js" subpaths: gramjs ships CommonJS without
    // package.json "exports", so production's strict ESM resolver rejects
    // bare directory imports like "telegram/sessions".
    const tg: any = await import("telegram");
    const sessionsMod: any = await import("telegram/sessions/index.js");
    const eventsMod: any = await import("telegram/events/index.js");
    const { TelegramClient, Api } = tg;
    const { StringSession } = sessionsMod;
    const { NewMessage } = eventsMod;

    console.log("[telegram] gramjs imported, creating client...");

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      // connectionRetries: 0 — we manage retries ourselves via pollForNewMedia.
      // gramjs's internal retry loop creates new auth key negotiation attempts
      // on each retry, which compounds AUTH_KEY_DUPLICATED conflicts.
      connectionRetries: 0,
    });
    if (client.setLogLevel) {
      try { client.setLogLevel("error"); } catch {}
    }
    // Store early so the catch block can call disconnect() even on failure.
    telegramClient = client;

    console.log("[telegram] connecting (timeout 30s)...");
    // Race client.connect() against a 30-second timeout so a hung TCP
    // handshake doesn't block the function forever without logging anything.
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("connect() timed out after 30s")),
          CONNECT_TIMEOUT_MS,
        ),
      ),
    ]);
    console.log("[telegram] connected, checking authorization...");

    const authorized = await withTimeout(
      client.isUserAuthorized(),
      GRAMJS_CALL_TIMEOUT_MS,
      "isUserAuthorized",
    );
    console.log(`[telegram] isUserAuthorized=${authorized}`);
    if (!authorized) {
      console.error(
        "[telegram] session string is not authorized — re-run scripts/telegramLogin.ts",
      );
      isConnecting = false;
      isConnectingSince = null;
      return;
    }

    // Resolve channel via invite link (idempotent: already-member falls back to CheckChatInvite)
    console.log("[telegram] resolving channel...");
    try {
      const res: any = await withTimeout(
        client.invoke(new Api.messages.ImportChatInvite({ hash: INVITE_HASH })),
        GRAMJS_CALL_TIMEOUT_MS,
        "ImportChatInvite",
      );
      const chat = res?.chats?.[0];
      if (chat?.id) resolvedChannelId = BigInt(chat.id.toString());
    } catch (e: any) {
      const msg = e?.errorMessage || e?.message || "";
      if (msg.includes("USER_ALREADY_PARTICIPANT")) {
        try {
          const inv: any = await withTimeout(
            client.invoke(new Api.messages.CheckChatInvite({ hash: INVITE_HASH })),
            GRAMJS_CALL_TIMEOUT_MS,
            "CheckChatInvite",
          );
          const chat = inv?.chat;
          if (chat?.id) resolvedChannelId = BigInt(chat.id.toString());
        } catch (e2: any) {
          console.error(
            "[telegram] CheckChatInvite failed:",
            e2?.errorMessage || e2?.message,
          );
        }
      } else {
        console.error("[telegram] failed to resolve channel:", msg);
      }
    }

    if (!resolvedChannelId) {
      console.error(
        "[telegram] could not determine channel id — event handler disabled (polling still active)",
      );
      isConnecting = false;
      isConnectingSince = null;
      return;
    }

    // Store for polling reuse.
    telegramClient = client;
    telegramApiRef = Api;

    listenerStarted = true;
    isConnecting = false;
    isConnectingSince = null; // clear so future retry logic doesn't get stuck
    console.log(`[telegram] listening to channel id=${resolvedChannelId}`);

    // Backfill + initial rotation in the background.
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

    // Real-time event handler (best-effort — polling is the reliable fallback).
    client.addEventHandler(async (event: any) => {
      try {
        const msg = event.message;
        if (!msg?.media) return;
        const peer = msg.peerId;
        const peerChannelId = peer?.channelId
          ? BigInt(peer.channelId.toString())
          : null;
        if (!peerChannelId || peerChannelId !== resolvedChannelId) return;
        const wasNew = await ingestMessage(client, msg, Api);
        if (wasNew) {
          const n = await rotateDailyDisplay();
          if (n > 0 && currentHourInET() >= ROTATION_HOUR_ET) {
            lastRotationDateET = todayInET();
          }
        }
      } catch (err) {
        console.warn("[telegram] handler error:", (err as Error).message);
      }
    }, new NewMessage({}));

    client.session.save();
  } catch (e) {
    const errMsg = (e as Error).message || "";
    if (errMsg.includes("AUTH_KEY_DUPLICATED")) {
      // Another connection is using this auth key. Explicitly disconnect the
      // client we just created so Telegram knows we're done with it, then
      // back off 2 minutes before the next poll cycle retries.
      console.warn(
        "[telegram] AUTH_KEY_DUPLICATED — disconnecting and backing off 2 min before retry...",
      );
      try { await telegramClient?.disconnect(); } catch {}
      telegramClient = null;
      // 2-minute back-off inside this call so the next pollForNewMedia cycle
      // (scheduled 5 min from now) finds a clear channel.
      await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    } else {
      console.error("[telegram] failed to start listener:", errMsg);
    }
    isConnecting = false;
    isConnectingSince = null;
  }
}

/** Call on process shutdown to release the Telegram auth key gracefully. */
export async function disconnectTelegramClient(): Promise<void> {
  if (telegramClient) {
    try { await telegramClient.disconnect(); } catch {}
    telegramClient = null;
  }
}

export async function initTelegramService(app: Express) {
  try {
    await ensureTable();
    await ensureUploadDir();

    app.use(
      PUBLIC_PREFIX,
      express.static(UPLOAD_DIR, { maxAge: "1h", fallthrough: true }),
    );

    // Serve the static "winnings" gallery files. Same /uploads/ prefix so
    // the existing safeUrl() check on the landing page accepts them.
    app.use(
      FALLBACK_PREFIX,
      express.static(FALLBACK_DIR, { maxAge: "7d", fallthrough: true }),
    );

    await loadFallbackItems();

    app.get("/api/landing/telegram-media", async (_req: Request, res: Response) => {
      try {
        const items = await getActiveMedia();
        // Always append the static fallback gallery AFTER live Telegram
        // items, so the landing-page slider keeps showing winnings even
        // during a Telegram outage and never goes empty.
        res.setHeader("Cache-Control", "public, max-age=30");
        res.json({ items: [...items, ...fallbackItems] });
      } catch (e) {
        console.warn("[telegram] api error:", (e as Error).message);
        res.json({ items: fallbackItems });
      }
    });

    setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
    void cleanupExpired();

    // Display set rotates once per day at 11 AM America/New_York.
    // We poll every minute (cheap) and run rotation once per ET day.
    setInterval(checkRotation, ROTATION_CHECK_INTERVAL_MS);
    void ensureInitialRotation();

    // Start the persistent MTProto listener (best-effort). Even if connect()
    // hangs or the session is invalid, the polling interval below is the
    // reliable backbone that will always pick up new channel posts.
    void startTelegramListener();

    // Polling fallback: every 90 seconds, pull the latest 30 messages from the
    // channel and ingest anything new. This is the primary mechanism that
    // ensures production stays current even when the persistent event handler
    // drops silently. pollForNewMedia is also self-healing — it detects a
    // broken/never-connected client and forces a clean reconnect.
    setTimeout(() => void pollForNewMedia(), FIRST_POLL_DELAY_MS);
    setInterval(() => void pollForNewMedia(), POLL_INTERVAL_MS);

    console.log("[telegram] service initialized");
  } catch (e) {
    console.error("[telegram] init failed:", (e as Error).message);
  }
}
