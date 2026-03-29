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

const JWT_EXPIRY = "30d";

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { sub: string };
  } catch {
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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.userId = payload.sub;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload?.sub) {
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
