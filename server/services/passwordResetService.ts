import crypto from "node:crypto";
import { db } from "../db";
import { sql } from "drizzle-orm";

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function initPasswordResetTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
    ON password_reset_tokens(user_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
    ON password_reset_tokens(expires_at)
  `);
  console.log("[auth] password_reset_tokens table ready");
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Invalidate any prior unused tokens for this user — only the latest link works.
  await db.execute(sql`
    UPDATE password_reset_tokens
    SET used_at = NOW()
    WHERE user_id = ${userId} AND used_at IS NULL
  `);

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.execute(sql`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt.toISOString()})
  `);
  return raw;
}

export interface ConsumedToken {
  userId: string;
}

// Atomically validate + consume a reset token AND apply the new password
// hash in a single DB transaction. If the password update fails, the
// transaction rolls back and the token remains usable so the user can retry
// without restarting the forgot-password flow. Returns the user id on
// success, null if the token was invalid/expired/already-used or if the
// underlying user no longer exists.
export async function consumeTokenAndResetPassword(
  rawToken: string,
  newPasswordHash: string,
): Promise<ConsumedToken | null> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) return null;
  const tokenHash = hashToken(rawToken);
  try {
    return await db.transaction(async (tx) => {
      const tokenResult: any = await tx.execute(sql`
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE token_hash = ${tokenHash}
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING user_id
      `);
      const tokenRows: any[] = Array.isArray(tokenResult)
        ? tokenResult
        : (tokenResult?.rows ?? []);
      const userId = tokenRows[0]?.user_id;
      if (!userId) {
        // Force rollback so the SELECT side-effects (none here, but keeps
        // the contract clean) are reverted.
        throw new InvalidTokenError();
      }
      const userResult: any = await tx.execute(sql`
        UPDATE users
        SET password = ${newPasswordHash},
            token_version = token_version + 1
        WHERE id = ${userId}
        RETURNING id
      `);
      const userRows: any[] = Array.isArray(userResult)
        ? userResult
        : (userResult?.rows ?? []);
      if (!userRows[0]?.id) {
        // User was deleted between token issuance and consumption.
        throw new InvalidTokenError();
      }
      return { userId: String(userId) };
    });
  } catch (err: any) {
    if (err instanceof InvalidTokenError) return null;
    throw err;
  }
}

class InvalidTokenError extends Error {
  constructor() {
    super("invalid_token");
    this.name = "InvalidTokenError";
  }
}

export async function purgeExpiredResetTokens(): Promise<void> {
  try {
    await db.execute(sql`
      DELETE FROM password_reset_tokens
      WHERE expires_at < NOW() - INTERVAL '7 days'
    `);
  } catch (err: any) {
    console.warn("[auth] purge expired reset tokens failed:", err?.message);
  }
}
