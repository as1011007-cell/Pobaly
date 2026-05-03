import { Express, Request, Response } from "express";
import express from "express";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { db } from "../db";
import { sql } from "drizzle-orm";
import type { Prediction } from "@shared/schema";

const PUBLER_API_BASE = "https://app.publer.com/api/v1";
const UPLOAD_DIR = path.resolve(process.cwd(), "server", "uploads", "social");
const PUBLIC_PREFIX = "/uploads/social";

function getPublicBaseUrl(): string {
  const fromEnv = process.env.PUBLIC_BASE_URL || process.env.EXPO_PUBLIC_DOMAIN;
  if (fromEnv) return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
  return "https://probaly.net";
}

function getApiKey(): string | null {
  return process.env.PUBLER_API_KEY || null;
}

function getWorkspaceId(): string | null {
  return process.env.PUBLER_WORKSPACE_ID || null;
}

function getAccountIds(): string[] {
  const raw = process.env.PUBLER_ACCOUNT_IDS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function publerFetch(
  pathname: string,
  init: RequestInit = {},
  withWorkspace = true,
): Promise<{ ok: boolean; status: number; body: any }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("PUBLER_API_KEY not set");

  const headers: Record<string, string> = {
    Authorization: `Bearer-API ${apiKey}`,
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };

  if (withWorkspace) {
    const ws = getWorkspaceId();
    if (ws) headers["Publer-Workspace-Id"] = ws;
  }

  const res = await fetch(`${PUBLER_API_BASE}${pathname}`, { ...init, headers });
  let body: any = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_posts (
      id SERIAL PRIMARY KEY,
      prediction_id INTEGER NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'publer',
      job_id TEXT,
      image_url TEXT,
      caption TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      posted_at TIMESTAMP
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_social_posts_prediction ON social_posts(prediction_id)
  `);
  // Match-level dedup so a single match (with N premium copies + 1 free row)
  // produces at most one social post.
  await db.execute(sql`
    ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS match_key TEXT
  `);
  // When the post is queued at Publer to publish.
  await db.execute(sql`
    ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_match_key
    ON social_posts(match_key) WHERE match_key IS NOT NULL
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_for
    ON social_posts(scheduled_for)
  `);
}

// Daily slots (UTC) — 8 evenly spread between 10 AM and ~9 PM.
// Picked to span EU evenings + US morning/afternoon.
const DAILY_SLOTS_UTC: Array<[number, number]> = [
  [10, 0], [11, 30], [13, 0], [14, 30],
  [16, 0], [17, 30], [19, 0], [20, 30],
];
const MAX_FUTURE_SCHEDULED = 16; // ~2 days worth — drop wins beyond this

function makeMatchKey(matchTitle: string): string {
  return matchTitle.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildSlotForDay(day: Date, slotIdx: number): Date {
  const [h, m] = DAILY_SLOTS_UTC[slotIdx];
  const d = new Date(day);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

/**
 * Pick the next free slot from now onward. A slot is "taken" if any existing
 * scheduled post is within ±30 min of it. Returns null if the queue is full
 * (>= MAX_FUTURE_SCHEDULED future-scheduled posts).
 */
async function pickNextSlot(now: Date): Promise<Date | null> {
  const r = await db.execute(sql`
    SELECT scheduled_for FROM social_posts
    WHERE scheduled_for IS NOT NULL
      AND scheduled_for >= ${now.toISOString()}::timestamp
      AND status IN ('pending','queued','posted')
    ORDER BY scheduled_for ASC
  `);
  const taken = (r.rows || []).map((row: any) => new Date(row.scheduled_for as string));
  if (taken.length >= MAX_FUTURE_SCHEDULED) return null;

  const minStart = new Date(now.getTime() + 5 * 60 * 1000); // 5-min lead time
  // Try today + next 6 days as a safety horizon (we'll bail out before that
  // hits via MAX_FUTURE_SCHEDULED, but the loop bound prevents runaway).
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    for (let i = 0; i < DAILY_SLOTS_UTC.length; i++) {
      const slot = buildSlotForDay(day, i);
      if (slot < minStart) continue;
      const collides = taken.some(
        (t) => Math.abs(t.getTime() - slot.getTime()) < 30 * 60 * 1000,
      );
      if (!collides) return slot;
    }
  }
  return null;
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Atomic claim by (prediction_id, match_key, scheduled_for). Two unique
 * constraints exist: prediction_id (so the same row can't claim twice) and
 * match_key (so a single match — which has many prediction rows, one per
 * premium subscriber + one free — produces at most one social post).
 * Insert is attempted with prediction_id conflict-ignore; if that succeeds,
 * we then check match_key uniqueness via a second insert path. Simplest
 * implementation: a single INSERT that conflicts on EITHER unique key, then
 * verify by SELECT what we got.
 */
function rowsOf(r: any): any[] {
  // Drizzle's db.execute() result shape varies by driver (neon-http vs
  // neon-serverless vs node-postgres). Defensively unwrap: some drivers put
  // rows on .rows, others on the result itself.
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.rows)) return r.rows;
  if (Array.isArray(r?.rowCount) /* never */ ) return [];
  return [];
}

async function claimMatchSlot(
  predictionId: number,
  matchKey: string,
  scheduledFor: Date,
): Promise<boolean> {
  // 1) Bail early if THIS match has already been claimed (by any prediction).
  const existing = await db.execute(sql`
    SELECT id FROM social_posts WHERE match_key = ${matchKey} LIMIT 1
  `);
  if (rowsOf(existing).length > 0) {
    console.log(`[PUBLER] claim: match_key="${matchKey}" already in social_posts`);
    return false;
  }

  // 2) Attempt the insert. ON CONFLICT covers the prediction_id key; the
  // partial UNIQUE on match_key is caught via 23505 below for the rare
  // sibling race. We don't rely on RETURNING parsing because the result
  // shape is driver-dependent — instead we verify by SELECT after.
  try {
    await db.execute(sql`
      INSERT INTO social_posts (prediction_id, match_key, scheduled_for, status)
      VALUES (${predictionId}, ${matchKey}, ${scheduledFor.toISOString()}::timestamp, 'pending')
      ON CONFLICT (prediction_id) DO NOTHING
    `);
  } catch (err: any) {
    if (err?.code === "23505") {
      console.log(`[PUBLER] claim: 23505 race on match_key="${matchKey}"`);
      return false;
    }
    throw err;
  }

  // 3) Verify our row landed (so we know we own this prediction's claim).
  const verify = await db.execute(sql`
    SELECT match_key FROM social_posts WHERE prediction_id = ${predictionId} LIMIT 1
  `);
  const rows = rowsOf(verify);
  if (rows.length === 0) {
    console.log(`[PUBLER] claim: verify returned 0 rows for pred=${predictionId}`);
    return false;
  }
  const ownsMatch = (rows[0] as any).match_key === matchKey;
  if (!ownsMatch) {
    console.log(
      `[PUBLER] claim: pred=${predictionId} exists with different match_key (was ${(rows[0] as any).match_key}, wanted ${matchKey})`,
    );
    return false;
  }
  return true;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxChars) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function composeWinImage(
  prediction: Prediction,
  scoreLine: string,
): Promise<{ filePath: string; publicUrl: string; fileName: string }> {
  await ensureUploadDir();

  const W = 1080;
  const H = 1080;
  const navy = "#1A237E";
  const red = "#E53935";
  const cream = "#F5F5F5";
  const emerald = "#10B981";

  const matchLines = wrapText(prediction.matchTitle, 22).slice(0, 2);
  const scoreLines = wrapText(scoreLine, 26).slice(0, 2);
  const pickLine = prediction.predictedOutcome.length > 28
    ? prediction.predictedOutcome.slice(0, 27) + "…"
    : prediction.predictedOutcome;

  const matchTSpans = matchLines
    .map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 70}">${escapeXml(l)}</tspan>`)
    .join("");
  const scoreTSpans = scoreLines
    .map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 50}">${escapeXml(l)}</tspan>`)
    .join("");

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1A237E"/>
      <stop offset="100%" stop-color="#0D1452"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="14" fill="${red}"/>
  <rect x="0" y="${H - 14}" width="${W}" height="14" fill="${red}"/>

  <text x="540" y="180" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="${cream}" text-anchor="middle" letter-spacing="6">PROBALY PICK RESULT</text>

  <rect x="290" y="225" width="500" height="90" rx="45" fill="${emerald}"/>
  <text x="540" y="288" font-family="Helvetica, Arial, sans-serif" font-size="58" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="3">WE CALLED IT</text>

  <text x="540" y="430" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="800" fill="${cream}" text-anchor="middle">${matchTSpans}</text>

  <line x1="200" y1="${matchLines.length > 1 ? 590 : 520}" x2="880" y2="${matchLines.length > 1 ? 590 : 520}" stroke="${red}" stroke-width="4"/>

  <text x="540" y="${matchLines.length > 1 ? 660 : 600}" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="500" fill="#B0BEC5" text-anchor="middle" letter-spacing="3">OUR PICK</text>
  <text x="540" y="${matchLines.length > 1 ? 730 : 670}" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700" fill="${cream}" text-anchor="middle">${escapeXml(pickLine)}</text>

  <text x="540" y="${matchLines.length > 1 ? 820 : 770}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="500" fill="#B0BEC5" text-anchor="middle" letter-spacing="3">FINAL</text>
  <text x="540" y="${matchLines.length > 1 ? 880 : 830}" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="${cream}" text-anchor="middle">${scoreTSpans}</text>

  <text x="540" y="990" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="800" fill="${red}" text-anchor="middle" letter-spacing="8">PROBALY</text>
  <text x="540" y="1030" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="500" fill="#90A4AE" text-anchor="middle" letter-spacing="4">probaly.net</text>
</svg>`.trim();

  const fileName = `win-${prediction.id}-${Date.now()}.png`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(filePath);

  const publicUrl = `${getPublicBaseUrl()}${PUBLIC_PREFIX}/${fileName}`;
  return { filePath, publicUrl, fileName };
}

export function buildWinCaption(prediction: Prediction, scoreLine: string): string {
  const sport = (prediction.sport || "").toUpperCase();
  return [
    `WE CALLED IT.`,
    ``,
    `${prediction.matchTitle}`,
    `Our AI pick: ${prediction.predictedOutcome}`,
    `Final: ${scoreLine}`,
    ``,
    `Probaly is available on the App Store and Play Store.`,
    `Visit probaly.net for more info.`,
    ``,
    `#Probaly #${sport} #SportsAnalytics #AI #SportsBetting`,
  ].join("\n");
}

export interface PublerPostResult {
  ok: boolean;
  jobId?: string;
  status: number;
  body: any;
}

/**
 * Upload a local image file to Publer's media API (multipart/form-data).
 * Returns the Publer media ID to reference in the post payload.
 */
async function uploadMediaToPubler(filePath: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("PUBLER_API_KEY not set");
  const ws = getWorkspaceId();
  if (!ws) throw new Error("PUBLER_WORKSPACE_ID not set");

  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);

  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "image/png" }), fileName);

  const res = await fetch(`${PUBLER_API_BASE}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer-API ${apiKey}`,
      "Publer-Workspace-Id": ws,
      // No Content-Type — let fetch set multipart/form-data boundary automatically
    },
    body: form,
  });

  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text; }

  if (!res.ok) {
    throw new Error(`Publer media upload failed (${res.status}): ${JSON.stringify(body).slice(0, 400)}`);
  }

  const mediaId = body?.id;
  if (!mediaId) throw new Error(`Publer media upload: no id in response: ${JSON.stringify(body).slice(0, 200)}`);
  console.log(`[PUBLER] Uploaded media to Publer, id=${mediaId}`);
  return mediaId;
}

export async function publerSchedulePublish(
  caption: string,
  imageFilePath: string,
  options: {
    state?: "scheduled" | "draft";
    accounts?: string[];
    scheduledAt?: Date;
  } = {},
): Promise<PublerPostResult> {
  const accountIds = options.accounts || getAccountIds();
  if (accountIds.length === 0) throw new Error("PUBLER_ACCOUNT_IDS not set");

  // Step 1: upload image to Publer's media API → get a media ID
  const mediaId = await uploadMediaToPubler(imageFilePath);

  // Step 2: build correctly-shaped payload per Publer API v1 docs.
  // - networks.default applies to all targeted account providers
  // - scheduled_at goes on each account object, NOT on the post
  // - accounts is an array of {id, scheduled_at?} objects
  const accountObjs = accountIds.map((id) => {
    const obj: any = { id };
    if (options.scheduledAt) obj.scheduled_at = options.scheduledAt.toISOString();
    return obj;
  });

  const body = {
    bulk: {
      state: options.state || "scheduled",
      posts: [
        {
          networks: {
            default: {
              type: "photo",
              text: caption,
              media: [{ id: mediaId, type: "image" }],
            },
          },
          accounts: accountObjs,
        },
      ],
    },
  };

  // Correct endpoint: /posts/schedule (not /posts/schedule/publish)
  const r = await publerFetch("/posts/schedule", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const jobId =
    r.body?.job_id || r.body?.id || (Array.isArray(r.body) ? r.body[0]?.job_id : undefined);

  return { ok: r.ok, jobId, status: r.status, body: r.body };
}

export async function listWorkspaces() {
  return await publerFetch("/workspaces", { method: "GET" }, false);
}

export async function listAccounts() {
  return await publerFetch("/accounts", { method: "GET" }, true);
}

// Skip wins for matches that started > this many hours ago, so we never
// backfill ancient wins from before the auto-poster was enabled.
const STALE_MATCH_HOURS = 24;

export async function postWinCelebration(
  prediction: Prediction,
  scoreLine: string,
): Promise<{ ok: boolean; reason?: string; jobId?: string; scheduledFor?: string }> {
  if (!getApiKey()) {
    console.log("[PUBLER] PUBLER_API_KEY not set — skipping social post");
    return { ok: false, reason: "no_api_key" };
  }
  if (!getWorkspaceId() || getAccountIds().length === 0) {
    console.log(
      "[PUBLER] PUBLER_WORKSPACE_ID or PUBLER_ACCOUNT_IDS missing — skipping. Hit GET /api/admin/publer/discover to fetch them.",
    );
    return { ok: false, reason: "missing_workspace_or_accounts" };
  }

  // Freshness gate: only post wins for matches from "today" (last 24h).
  const matchTime = (prediction as any).matchTime
    ? new Date((prediction as any).matchTime)
    : null;
  if (matchTime && Number.isFinite(matchTime.getTime())) {
    const ageHours = (Date.now() - matchTime.getTime()) / 3_600_000;
    if (ageHours > STALE_MATCH_HOURS) {
      console.log(
        `[PUBLER] Prediction ${prediction.id} match is ${ageHours.toFixed(1)}h old (>${STALE_MATCH_HOURS}h) — skipping stale win`,
      );
      return { ok: false, reason: "stale_match" };
    }
  }

  // Pick a free slot in the daily 8-slot schedule.
  const slot = await pickNextSlot(new Date());
  if (!slot) {
    console.log(
      `[PUBLER] Schedule is full (>= ${MAX_FUTURE_SCHEDULED} future-scheduled posts) — dropping ${prediction.id}`,
    );
    return { ok: false, reason: "queue_full" };
  }

  // Atomic claim by match_key: a single match (with N premium copies + 1 free)
  // produces at most one social post. Concurrent siblings bail out cleanly.
  const matchKey = makeMatchKey(prediction.matchTitle);
  const claimed = await claimMatchSlot(prediction.id, matchKey, slot);
  if (!claimed) {
    console.log(
      `[PUBLER] Match "${matchKey}" already claimed (or prediction ${prediction.id} already posted) — skipping`,
    );
    return { ok: false, reason: "already_claimed" };
  }

  let imageUrl: string;
  let imageFilePath: string;
  try {
    const img = await composeWinImage(prediction, scoreLine);
    imageUrl = img.publicUrl;
    imageFilePath = img.filePath;
    console.log(`[PUBLER] Composed image: ${imageUrl}, scheduled for ${slot.toISOString()}`);
  } catch (err: any) {
    console.error("[PUBLER] Image composition failed:", err);
    await db.execute(sql`
      UPDATE social_posts SET status='failed', error=${`compose:${err?.message || String(err)}`}
      WHERE prediction_id = ${prediction.id}
    `);
    return { ok: false, reason: "compose_failed" };
  }

  const caption = buildWinCaption(prediction, scoreLine);

  try {
    const r = await publerSchedulePublish(caption, imageFilePath, {
      state: "scheduled",
      scheduledAt: slot,
    });
    if (!r.ok) {
      console.error(`[PUBLER] Publish failed (${r.status}):`, JSON.stringify(r.body).slice(0, 500));
      await db.execute(sql`
        UPDATE social_posts
        SET image_url=${imageUrl}, caption=${caption}, status='failed',
            error=${`publer:${r.status}:${JSON.stringify(r.body).slice(0, 400)}`}
        WHERE prediction_id = ${prediction.id}
      `);
      return { ok: false, reason: `publer_${r.status}` };
    }
    console.log(
      `[PUBLER] Queued post for prediction ${prediction.id} at ${slot.toISOString()}, job=${r.jobId}`,
    );
    await db.execute(sql`
      UPDATE social_posts
      SET job_id=${r.jobId || null}, image_url=${imageUrl}, caption=${caption},
          status='queued', posted_at=NOW(), error=NULL
      WHERE prediction_id = ${prediction.id}
    `);
    return { ok: true, jobId: r.jobId, scheduledFor: slot.toISOString() };
  } catch (err: any) {
    console.error("[PUBLER] Network/exception:", err);
    await db.execute(sql`
      UPDATE social_posts
      SET image_url=${imageUrl}, caption=${caption}, status='failed', error=${err?.message || String(err)}
      WHERE prediction_id = ${prediction.id}
    `);
    return { ok: false, reason: "exception" };
  }
}

// Back-compat alias — call sites still using the old name keep working.
export const postFreeTipWin = postWinCelebration;

export async function initPublerService(app: Express) {
  await ensureTable();
  await ensureUploadDir();

  app.use(
    PUBLIC_PREFIX,
    express.static(UPLOAD_DIR, { maxAge: "7d", fallthrough: true }),
  );

  console.log(
    `[PUBLER] Initialized. Public dir: ${PUBLIC_PREFIX}. API key: ${getApiKey() ? "set" : "MISSING"}, workspace: ${getWorkspaceId() ? "set" : "MISSING"}, accounts: ${getAccountIds().length}`,
  );
}
