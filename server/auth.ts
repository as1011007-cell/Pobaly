import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "crypto";

function getJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.REPLIT_DEPLOYMENT === "1") {
    throw new Error("JWT_SECRET must be set in production");
  }
  if (process.env.DATABASE_URL) {
    return createHash("sha256").update(process.env.DATABASE_URL).digest("hex");
  }
  return "fallback-dev-secret-not-for-production";
}

const JWT_EXPIRY = "365d";

export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    { sub: userId, tv: tokenVersion },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRY },
  );
}

export function verifyToken(token: string): { sub: string; tv?: number } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { sub: string; tv?: number };
  } catch {
    return null;
  }
}

// ---- Single-active-session support -----------------------------------------
// Each user has a `token_version` counter in the DB. Every successful login
// increments it, embedding the new value into the freshly issued JWT. On
// every authenticated request we compare the JWT's `tv` claim against the
// user's current `token_version`. If they differ, the token came from a
// previous login session and we reject it. A short-TTL in-memory cache keeps
// the per-request DB lookup cheap.

const TOKEN_VERSION_TTL_MS = 60_000;
const tokenVersionCache = new Map<string, { version: number; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokenVersionCache) {
    if (v.expiresAt < now) tokenVersionCache.delete(k);
  }
}, 5 * 60_000);

export function setCachedTokenVersion(userId: string, version: number) {
  tokenVersionCache.set(userId, {
    version,
    expiresAt: Date.now() + TOKEN_VERSION_TTL_MS,
  });
}

async function getCurrentTokenVersion(userId: string): Promise<number | null> {
  const cached = tokenVersionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.version;

  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const result: any = await db.execute(
      sql`SELECT token_version FROM users WHERE id = ${userId}`,
    );
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    if (rows.length === 0) return null;
    const version = Number(rows[0]?.token_version ?? 0);
    setCachedTokenVersion(userId, version);
    return version;
  } catch (err) {
    console.warn("[AUTH] token_version lookup failed:", (err as Error).message);
    // Fail-open: if the DB lookup fails, accept the JWT's claim rather than
    // locking everyone out due to a transient DB issue.
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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
  // Tokens issued before token_version existed have no `tv` claim — treat
  // them as version 0 so they keep working until the user logs in again
  // (the first new login bumps version to 1 and invalidates them).
  const tokenTv = typeof payload.tv === "number" ? payload.tv : 0;
  if (currentVersion !== null && tokenTv !== currentVersion) {
    return res.status(401).json({
      error: "Your session ended because this account signed in on another device.",
      code: "SESSION_REVOKED",
    });
  }

  req.userId = payload.sub;
  next();
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload?.sub) {
      const currentVersion = await getCurrentTokenVersion(payload.sub);
      const tokenTv = typeof payload.tv === "number" ? payload.tv : 0;
      if (currentVersion !== null && tokenTv !== currentVersion) {
        // The client is presenting a token from a previous session — kick it
        // out even on otherwise-public endpoints so the app signs out fast.
        return res.status(401).json({
          error: "Your session ended because this account signed in on another device.",
          code: "SESSION_REVOKED",
        });
      }
      req.userId = payload.sub;
    }
  }
  next();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  try {
    const { timingSafeEqual: tse } = require("crypto");
    return tse(bufA, bufB);
  } catch {
    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
      result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
  }
}

export function requireWebhookAuth(secretEnvVar: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env[secretEnvVar];
    if (!secret) {
      console.error(`SECURITY WARNING: ${secretEnvVar} is not configured — webhook requests are unauthenticated. Set this secret to enable webhook verification.`);
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn(`[WEBHOOK AUTH] Missing Authorization header for ${secretEnvVar}`);
      return res.status(401).json({ error: "Unauthorized webhook request" });
    }

    // Accept either "Bearer <secret>" or the bare secret as the header value.
    // RevenueCat's dashboard lets you put any string in the Authorization
    // header, so users commonly paste the secret directly without a "Bearer "
    // prefix. Both formats are accepted to avoid rejecting legitimate hooks.
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (!timingSafeEqual(provided, secret)) {
      const preview = (s: string) => s.length <= 8 ? `len=${s.length}` : `len=${s.length} ${s.slice(0, 4)}…${s.slice(-4)}`;
      console.warn(`[WEBHOOK AUTH] Invalid secret for ${secretEnvVar}. expected ${preview(secret)} got ${preview(provided)}`);
      return res.status(401).json({ error: "Unauthorized webhook request" });
    }

    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(503).json({ error: "Admin access not configured" });
  }

  const providedKey = req.headers["x-admin-key"] as string;

  if (!providedKey || !timingSafeEqual(providedKey, adminKey)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

let rateLimitCounter = 0;

export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const scope = `rl_${++rateLimitCounter}`;
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = options.keyGenerator
      ? options.keyGenerator(req)
      : req.ip || req.headers["x-forwarded-for"] as string || "unknown";
    const key = `${scope}:${ip}`;

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    next();
  };
}
