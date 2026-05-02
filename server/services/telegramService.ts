import express, { type Express, type Request, type Response } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { db } from "../db";
import { sql } from "drizzle-orm";

const UPLOAD_DIR = path.resolve(process.cwd(), "server", "uploads", "telegram");
const PUBLIC_PREFIX = "/uploads/telegram";
const MAX_DISPLAY_ITEMS = 3;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const INVITE_HASH = process.env.TELEGRAM_INVITE_HASH || "5uZNUktfpeZiMjVi";

let listenerStarted = false;
let resolvedChannelId: bigint | null = null;

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
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function cleanupExpired() {
  try {
    const result: any = await db.execute(sql`
      SELECT id, file_path FROM telegram_media WHERE expires_at <= NOW()
    `);
    const rows: any[] = result.rows || result || [];
    for (const row of rows) {
      const filePath = path.join(UPLOAD_DIR, row.file_path);
      try {
        await fs.unlink(filePath);
      } catch {
        // file may already be gone
      }
    }
    if (rows.length > 0) {
      await db.execute(sql`DELETE FROM telegram_media WHERE expires_at <= NOW()`);
      console.log(`[telegram] cleanup removed ${rows.length} expired item(s)`);
    }
  } catch (e) {
    console.warn("[telegram] cleanup failed:", (e as Error).message);
  }
}

async function getActiveMedia() {
  const result: any = await db.execute(sql`
    SELECT id, telegram_message_id, media_type, file_path, mime_type,
           width, height, caption, created_at, expires_at
    FROM telegram_media
    WHERE expires_at > NOW()
    ORDER BY created_at DESC
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

async function ingestMessage(client: any, msg: any, Api: any) {
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

  if (!mediaType) return;

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    console.warn(
      `[telegram] skipping message ${messageId} — too large (${sizeBytes} bytes)`,
    );
    return;
  }

  const existing: any = await db.execute(sql`
    SELECT id FROM telegram_media WHERE telegram_message_id = ${messageId.toString()} LIMIT 1
  `);
  const existingRows: any[] = existing.rows || existing || [];
  if (existingRows.length > 0) return;

  const buffer: Buffer | undefined = await client.downloadMedia(msg, {});
  if (!buffer || !buffer.length) return;

  const filename = `${Date.now()}_${messageId.toString()}.${ext}`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(fullPath, buffer);

  const caption = msg.message || null;
  await db.execute(sql`
    INSERT INTO telegram_media
      (telegram_message_id, media_type, file_path, mime_type, width, height, caption, expires_at)
    VALUES (
      ${messageId.toString()}, ${mediaType}, ${filename}, ${mimeType},
      ${width}, ${height}, ${caption}, NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT (telegram_message_id) DO NOTHING
  `);
  console.log(
    `[telegram] ingested ${mediaType} message=${messageId} file=${filename} size=${sizeBytes}`,
  );
}

async function startTelegramListener() {
  if (listenerStarted) return;

  const apiIdRaw = process.env.TELEGRAM_API_ID || "";
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const sessionString = process.env.TELEGRAM_SESSION_STRING || "";
  const apiId = parseInt(apiIdRaw, 10);

  if (!apiId || !apiHash || !sessionString) {
    console.log(
      "[telegram] secrets not configured (TELEGRAM_API_ID/TELEGRAM_API_HASH/TELEGRAM_SESSION_STRING) — listener disabled",
    );
    return;
  }

  try {
    const tg: any = await import("telegram");
    const sessionsMod: any = await import("telegram/sessions");
    const eventsMod: any = await import("telegram/events");
    const { TelegramClient, Api } = tg;
    const { StringSession } = sessionsMod;
    const { NewMessage } = eventsMod;

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });
    // Reduce gramjs verbose logging
    if (client.setLogLevel) {
      try {
        client.setLogLevel("error");
      } catch {}
    }

    await client.connect();

    if (!(await client.isUserAuthorized())) {
      console.error(
        "[telegram] session string is not authorized — re-run scripts/telegramLogin.ts",
      );
      return;
    }

    // Resolve channel via invite link (idempotent: if already a member, fall back to CheckChatInvite)
    try {
      const res: any = await client.invoke(
        new Api.messages.ImportChatInvite({ hash: INVITE_HASH }),
      );
      const chat = res?.chats?.[0];
      if (chat?.id) resolvedChannelId = BigInt(chat.id.toString());
    } catch (e: any) {
      const msg = e?.errorMessage || e?.message || "";
      if (msg.includes("USER_ALREADY_PARTICIPANT")) {
        try {
          const inv: any = await client.invoke(
            new Api.messages.CheckChatInvite({ hash: INVITE_HASH }),
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
        "[telegram] could not determine channel id — listener will not start",
      );
      return;
    }

    listenerStarted = true;
    console.log(`[telegram] listening to channel id=${resolvedChannelId}`);

    client.addEventHandler(async (event: any) => {
      try {
        const msg = event.message;
        if (!msg?.media) return;
        const peer = msg.peerId;
        const peerChannelId = peer?.channelId
          ? BigInt(peer.channelId.toString())
          : null;
        if (!peerChannelId || peerChannelId !== resolvedChannelId) return;
        await ingestMessage(client, msg, Api);
      } catch (err) {
        console.warn("[telegram] handler error:", (err as Error).message);
      }
    }, new NewMessage({}));

    client.session.save();
  } catch (e) {
    console.error("[telegram] failed to start listener:", (e as Error).message);
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

    app.get("/api/landing/telegram-media", async (_req: Request, res: Response) => {
      try {
        const items = await getActiveMedia();
        res.setHeader("Cache-Control", "public, max-age=30");
        res.json({ items });
      } catch (e) {
        console.warn("[telegram] api error:", (e as Error).message);
        res.json({ items: [] });
      }
    });

    setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
    void cleanupExpired();
    void startTelegramListener();

    console.log("[telegram] service initialized");
  } catch (e) {
    console.error("[telegram] init failed:", (e as Error).message);
  }
}
