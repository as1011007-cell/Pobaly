import { Express, Request, Response } from "express";
import express from "express";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { db } from "../db";
import { sql } from "drizzle-orm";
import type { Prediction } from "@shared/schema";

const PUBLER_API_BASE = "https://app.publer.io/api/v1";
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
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Atomic claim: insert a 'pending' row for this prediction. ON CONFLICT DO
 * NOTHING means concurrent invocations all race to insert, but only ONE wins
 * (the one whose insert returns a row). Subsequent retries for permanently-
 * failed posts are still possible by deleting/clearing the row out-of-band.
 */
async function claimPost(predictionId: number): Promise<boolean> {
  const r = await db.execute(sql`
    INSERT INTO social_posts (prediction_id, status)
    VALUES (${predictionId}, 'pending')
    ON CONFLICT (prediction_id) DO NOTHING
    RETURNING id
  `);
  return (r.rows?.length || 0) > 0;
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

  <text x="540" y="180" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="${cream}" text-anchor="middle" letter-spacing="6">FREE TIP RESULT</text>

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
    `Our free pick: ${prediction.predictedOutcome}`,
    `Final: ${scoreLine}`,
    ``,
    `Get tomorrow's free AI pick at probaly.net`,
    ``,
    `#Probaly #${sport} #SportsAnalytics #AI #FreePick`,
  ].join("\n");
}

export interface PublerPostResult {
  ok: boolean;
  jobId?: string;
  status: number;
  body: any;
}

export async function publerSchedulePublish(
  caption: string,
  imageUrl: string,
  options: { state?: "scheduled" | "draft"; accounts?: string[] } = {},
): Promise<PublerPostResult> {
  const accounts = options.accounts || getAccountIds();
  if (accounts.length === 0) throw new Error("PUBLER_ACCOUNT_IDS not set");

  const body = {
    bulk: { state: options.state || "scheduled" },
    posts: [
      {
        accounts,
        networks: {},
        details: {
          text: caption,
          media: [{ path: imageUrl, type: "image" }],
        },
      },
    ],
  };

  const r = await publerFetch("/posts/schedule/publish", {
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

export async function postFreeTipWin(
  prediction: Prediction,
  scoreLine: string,
): Promise<{ ok: boolean; reason?: string; jobId?: string }> {
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

  // Atomic claim: insert pending row first. Only the winner of the unique
  // constraint race proceeds to compose + post; concurrent invocations bail
  // out cleanly without scheduling a duplicate Publer job.
  const claimed = await claimPost(prediction.id);
  if (!claimed) {
    console.log(`[PUBLER] Prediction ${prediction.id} already claimed — skipping (no double-post)`);
    return { ok: false, reason: "already_claimed" };
  }

  let imageUrl: string;
  try {
    const img = await composeWinImage(prediction, scoreLine);
    imageUrl = img.publicUrl;
    console.log(`[PUBLER] Composed image: ${imageUrl}`);
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
    const r = await publerSchedulePublish(caption, imageUrl, { state: "scheduled" });
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
    console.log(`[PUBLER] Queued post for prediction ${prediction.id}, job=${r.jobId}`);
    await db.execute(sql`
      UPDATE social_posts
      SET job_id=${r.jobId || null}, image_url=${imageUrl}, caption=${caption},
          status='queued', posted_at=NOW(), error=NULL
      WHERE prediction_id = ${prediction.id}
    `);
    return { ok: true, jobId: r.jobId };
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
