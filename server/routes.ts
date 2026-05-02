import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signToken, setCachedTokenVersion, requireAuth, optionalAuth, requireAdmin, requireWebhookAuth, rateLimit } from "./auth";
import { checkRCSubscription } from "./revenueCatService";
import { validateEmailDeliverable } from "./emailValidation";
import { sendPasswordResetEmail, isEmailConfigured } from "./services/emailService";
import { createPasswordResetToken, consumeTokenAndResetPassword } from "./services/passwordResetService";
const adminRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
import { db } from "./db";
import { sql, and } from "drizzle-orm";
import { predictions } from "@shared/schema";
import {
  generateDailyPredictions,
  generatePremiumPredictionsForUser,
  generateDemoPredictions,
  generateYesterdayHistory,
  getFreeTip,
  getPremiumPredictions,
  getLivePredictions,
  getHistoryPredictions,
  getPredictionsBySport,
  getPredictionById,
  markPredictionResult,
  getSportPredictionCounts,
  replaceFreeTip,
  forceRefreshHistory,
  generatePremiumHistory,
  forceNewFreeTip,
  dailyPredictionRefresh,
} from "./services/predictionService";
import { getLiveMatches } from "./services/sportsApiService";
import { normalizeLang, translatePredictions, translatePrediction, translatePredictionsBackground } from "./services/translationService";

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(100),
  referralCode: z.string().max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

const isoDateString = z.string().refine(
  (s) => !isNaN(Date.parse(s)),
  { message: "Invalid date/time format" }
);

const historyEntrySchema = z.object({
  matchTitle: z.string().min(1).max(500),
  sport: z.string().min(1).max(50),
  matchTime: isoDateString,
  predictedOutcome: z.string().min(1).max(500),
  probability: z.number().min(0).max(100),
  confidence: z.enum(["high", "medium", "low"]),
  explanation: z.string().max(2000).nullable().optional(),
  factors: z.array(z.string().max(500)).max(20).nullable().optional(),
  sportsbookOdds: z.record(z.string(), z.any()).nullable().optional(),
  riskIndex: z.number().min(0).max(10).optional(),
  isPremium: z.boolean().optional(),
  expiresAt: isoDateString.optional(),
});

const addHistorySchema = z.object({
  entries: z.array(historyEntrySchema).min(1).max(100),
});

const fixMigratedSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
});

// Detects whether a RevenueCat product identifier represents an annual plan.
// Case-insensitive and accepts the common variants used by Apple App Store and
// Google Play Console naming conventions: "annual", "yearly", "year".
// Examples that match: probaly_premium_annual, probaly_annual:annual,
// probaly_premium_yearly, probaly_premium_year, Probaly_Premium_ANNUAL.
function isAnnualProduct(productId: unknown): boolean {
  const id = String(productId || "").toLowerCase();
  return id.includes("annual") || id.includes("yearly") || /(^|[^a-z])year([^a-z]|$)/.test(id);
}

function safeErrorMessage(error: any, fallback = "An unexpected error occurred"): string {
  if (error instanceof z.ZodError) {
    return error.errors.map(e => e.message).join(", ");
  }
  if (typeof error?.message === "string" && error.message.length < 200) {
    if (/password|secret|key|token|sql|query|column|table|relation|database|stack|internal|connection|drizzle|postgres|pg_|stripe_|revenuecat|webhook|bcrypt|jwt|hash/i.test(error.message)) {
      return fallback;
    }
    return error.message;
  }
  return fallback;
}

function redactPrediction(p: any) {
  return {
    ...p,
    matchTitle: "Get Premium vs Get Premium",
    predictedOutcome: "Get Premium",
    probability: 90,
    confidence: "high",
    explanation: null,
    factors: null,
    sportsbookOdds: null,
    riskIndex: 0,
  };
}

const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const registerRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const forgotPasswordRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
const resetPasswordRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});
const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(6).max(128),
});
const contactRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
const generateRateLimit = rateLimit({ windowMs: 60 * 1000, max: 3 });
const apiReadRateLimit = rateLimit({ windowMs: 60 * 1000, max: 60 });
const apiWriteRateLimit = rateLimit({ windowMs: 60 * 1000, max: 15 });

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", registerRateLimit, async (req: Request, res: Response) => {
    try {
      const { email, password, name, referralCode } = registerSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();

      // Validate deliverability FIRST so that timing/response is similar for
      // existing-vs-new emails, mitigating user-enumeration via timing.
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
        name: name.trim(),
      }, referralCode);

      // Fresh user starts at token_version = 0 (DB default).
      setCachedTokenVersion(user.id, 0);
      const token = signToken(user.id, 0);

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isPremium: user.isPremium,
          subscriptionExpiry: user.subscriptionExpiry,
        },
        token,
      });
    } catch (error: any) {
      return res.status(400).json({ error: safeErrorMessage(error, "Registration failed") });
    }
  });

  // Account deletion — required by Apple App Store Review Guideline 5.1.1
  app.delete("/api/auth/account", requireAuth, apiWriteRateLimit, async (req: Request, res: Response) => {
    try {
      console.log(`Account deletion requested by user ${req.userId} — deletes disabled, returning success`);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Account deletion error:", error);
      return res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Password reset — request a reset link by email.
  // ALWAYS responds 200 so attackers can't enumerate which emails are
  // registered. Real failures (bad email format, SMTP down) are logged
  // server-side. Rate-limited per IP to slow down spam/abuse.
  app.post("/api/auth/forgot-password", forgotPasswordRateLimit, async (req: Request, res: Response) => {
    const okResponse = {
      success: true,
      message: "If an account exists for that email, a reset link has been sent.",
      emailConfigured: isEmailConfigured(),
    };
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        // Still return 200 to avoid leaking which emails are valid format-wise vs registered.
        return res.json(okResponse);
      }
      const normalizedEmail = parsed.data.email.toLowerCase().trim();
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        return res.json(okResponse);
      }

      const rawToken = await createPasswordResetToken(user.id);
      const baseUrl = (process.env.PUBLIC_BASE_URL || "https://probaly.net").replace(/\/+$/, "");
      const resetUrl = `${baseUrl}/auth/reset?token=${encodeURIComponent(rawToken)}`;

      // Fire-and-forget so the response time doesn't reveal whether SMTP was
      // hit (i.e. whether the user exists). Errors are logged in the service.
      void sendPasswordResetEmail(normalizedEmail, resetUrl, user.name).catch((err) => {
        console.error("[auth] sendPasswordResetEmail unexpected error:", err);
      });

      return res.json(okResponse);
    } catch (error: any) {
      console.error("[auth] forgot-password error:", error?.message || error);
      // Still 200 — never leak.
      return res.json(okResponse);
    }
  });

  // Password reset — consume token + set new password. On success the user's
  // token_version is bumped so any existing JWTs (other devices / the device
  // that initiated the reset) are invalidated immediately.
  app.post("/api/auth/reset-password", resetPasswordRateLimit, async (req: Request, res: Response) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(password, 12);
      // Token consumption + password update happen inside a single DB
      // transaction. If either step fails the transaction rolls back, so the
      // reset link is NOT burned on transient failures and the user can
      // retry without going through forgot-password again.
      let consumed;
      try {
        consumed = await consumeTokenAndResetPassword(token, hashedPassword);
      } catch (err) {
        console.error("[auth] reset-password tx failed:", (err as Error).message);
        return res.status(500).json({ error: "Could not reset password. Please try again." });
      }
      if (!consumed) {
        return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
      }

      return res.json({ success: true, message: "Your password has been reset. Please sign in with your new password." });
    } catch (error: any) {
      return res.status(400).json({ error: safeErrorMessage(error, "Could not reset password.") });
    }
  });

  app.post("/api/auth/login", loginRateLimit, async (req: Request, res: Response) => {
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

      // Single-active-session: bump the user's token_version so any token
      // issued to a previous device becomes invalid on its next request.
      // If the bump fails we MUST NOT issue a token — otherwise the new
      // token would carry tv=0 (or stale value) and previously-issued
      // tokens would remain usable, defeating the kickout guarantee.
      let newTokenVersion: number;
      try {
        const result: any = await db.execute(
          sql`UPDATE users SET token_version = token_version + 1 WHERE id = ${user.id} RETURNING token_version`,
        );
        const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
        const bumped = rows[0]?.token_version;
        if (bumped === undefined || bumped === null) {
          throw new Error("token_version bump returned no rows");
        }
        newTokenVersion = Number(bumped);
      } catch (err) {
        console.error("[AUTH] failed to bump token_version on login:", (err as Error).message);
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
          subscriptionExpiry: user.subscriptionExpiry,
        },
        token,
      });
    } catch (error: any) {
      return res.status(400).json({ error: safeErrorMessage(error, "Login failed") });
    }
  });


  // ============ Subscription / RevenueCat Routes ============

  // Uses optionalAuth so subscription status and RC background checks work
  // even when the JWT has expired (e.g. 30-day token from old builds).
  // The userId comes from the path param; auth userId is cross-checked when present.
  app.get("/api/subscription/:userId", optionalAuth, apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      // If authenticated, reject mismatched userId to prevent enumeration
      if (req.userId && req.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      let user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If user is not premium in DB, AWAIT the RC check and reflect the
      // result in this same response. Safety net for missed RC webhooks.
      if (!user.isPremium) {
        try {
          const rcStatus = await Promise.race([
            checkRCSubscription(userId),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
          ]);
          if (rcStatus?.isPremium) {
            const isAnnual = isAnnualProduct(rcStatus.productIdentifier);
            const expiry = rcStatus.expiryDate ?? (() => {
              const d = new Date();
              isAnnual ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
              return d;
            })();
            await storage.updateUserStripeInfo(userId, {
              isPremium: true,
              subscriptionExpiry: expiry,
              premiumSince: new Date(),
            });
            user = { ...user, isPremium: true, subscriptionExpiry: expiry } as typeof user;
            console.log(`[RC] sync check activated premium for user ${userId}`);
          }
        } catch (err) {
          console.error(`[RC] sync check failed for user ${userId}:`, err);
        }
      }

      return res.json({
        subscription: null,
        isPremium: user.isPremium || false,
        expiryDate: user.subscriptionExpiry,
      });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  const revenueCatSyncSchema = z.object({
    isSubscribed: z.boolean(),
    productIdentifier: z.string().max(200).optional(),
    // userId sent by client as fallback when auth token is expired
    userId: z.string().uuid().optional(),
  });

  const syncRateLimit = rateLimit({ windowMs: 60 * 1000, max: 5 });

  // Uses optionalAuth so an expired JWT doesn't silently drop the request.
  // When the JWT is missing/expired, userId must be in the body and the
  // purchase is verified server-side with RevenueCat before marking premium.
  app.post("/api/revenuecat/sync", optionalAuth, syncRateLimit, async (req: Request, res: Response) => {
    try {
      const parsed = revenueCatSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { isSubscribed, productIdentifier, userId: bodyUserId } = parsed.data;

      // Prefer the JWT-authenticated userId; fall back to body userId.
      const userId = req.userId ?? bodyUserId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // When userId came from the body (no valid JWT), require RevenueCat to
      // confirm the subscription server-side — prevents anyone from posting a
      // random userId and claiming premium without a real purchase.
      const jwtAuthenticated = !!req.userId;

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (isSubscribed) {
        // ALWAYS verify with RevenueCat server-side before granting premium.
        // Trusting the client's "isSubscribed: true" claim — even with a valid
        // JWT — is unsafe: a stale customerInfo cache from a previous user
        // (after sign-out/sign-in on the same device) would otherwise promote
        // an unrelated account to premium. RC is the source of truth; if RC
        // hasn't propagated the purchase yet, the webhook will reconcile, and
        // the client's AppState refresh will pick up isPremium=true on its
        // next call.
        const rcStatus = await checkRCSubscription(userId);
        if (!rcStatus?.isPremium) {
          console.log(
            `RevenueCat sync: claim rejected for user ${userId} — RC did not confirm (jwt=${jwtAuthenticated})`
          );
          return res.json({ isPremium: user.isPremium === true });
        }

        const expiry =
          rcStatus.expiryDate ??
          (() => {
            const d = new Date();
            const isAnn = isAnnualProduct(productIdentifier);
            isAnn ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
            return d;
          })();

        const wasAlreadyPremium = user.isPremium === true;
        const updateData: any = {
          isPremium: true,
          subscriptionExpiry: expiry,
        };
        if (!wasAlreadyPremium) {
          updateData.premiumSince = new Date();
        }

        await storage.updateUserStripeInfo(userId, updateData);
        const isAnnual = isAnnualProduct(productIdentifier);
        console.log(
          `RevenueCat sync [RC-verified]: user ${userId} → isPremium=true (${isAnnual ? "annual" : "monthly"})`
        );
        return res.json({ isPremium: true, subscriptionExpiry: expiry });
      } else {
        // Only allow a downgrade if the request was JWT-authenticated
        if (jwtAuthenticated) {
          await storage.updateUserStripeInfo(userId, { isPremium: false });
          console.log(`RevenueCat sync [client-claim]: user ${userId} → isPremium=false`);
        }
        return res.json({ isPremium: false });
      }
    } catch (error: any) {
      console.error("RevenueCat sync error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // RevenueCat webhook — handles subscription lifecycle events from RC dashboard.
  // Authenticated via the REVENUECAT_WEBHOOK_SECRET env var: RC sends whatever
  // string you configure in their dashboard's "Authorization" field as the
  // exact Authorization header value. requireWebhookAuth does a constant-time
  // compare and accepts both "Bearer <secret>" and bare-secret formats. If the
  // env var is unset, the middleware logs a warning and lets requests through
  // (dev-only fallback) — production must have the secret configured.
  // Without this, anyone who guessed the URL could POST a fake INITIAL_PURCHASE
  // event and grant themselves premium for any userId.
  app.post("/api/revenuecat/webhook", requireWebhookAuth("REVENUECAT_WEBHOOK_SECRET"), async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const eventType: string | undefined = event?.event?.type;
      const productId = event?.event?.product_id;
      const expirationAtMs = event?.event?.expiration_at_ms;

      // TRANSFER events use transferred_from/transferred_to arrays instead of
      // app_user_id. Every other event type uses app_user_id directly.
      const transferredFrom: string[] = Array.isArray(event?.event?.transferred_from)
        ? event.event.transferred_from
        : [];
      const transferredTo: string[] = Array.isArray(event?.event?.transferred_to)
        ? event.event.transferred_to
        : [];
      const appUserId: string | undefined =
        event?.event?.app_user_id ||
        (eventType === "TRANSFER" ? transferredTo[0] : undefined);

      console.log(
        `RevenueCat webhook received: type=${eventType} user=${appUserId} product=${productId}` +
          (eventType === "TRANSFER" ? ` from=[${transferredFrom.join(",")}] to=[${transferredTo.join(",")}]` : "")
      );

      if (!eventType) {
        console.warn("RevenueCat webhook: missing eventType", JSON.stringify(event).slice(0, 200));
        return res.status(400).json({ error: "Invalid webhook payload" });
      }

      // TRANSFER: subscription moves between accounts. Deactivate every
      // transferred_from user and activate the transferred_to user.
      if (eventType === "TRANSFER") {
        for (const fromId of transferredFrom) {
          const fromUser = await storage.getUser(String(fromId));
          if (fromUser) {
            await storage.updateUserStripeInfo(String(fromId), { isPremium: false });
            console.log(`RevenueCat webhook: TRANSFER → isPremium=false for ${fromId}`);
          }
        }
        for (const toId of transferredTo) {
          const toUser = await storage.getUser(String(toId));
          if (!toUser) {
            console.log(`RevenueCat webhook: TRANSFER target ${toId} not in DB (skipping activation)`);
            continue;
          }
          const expiry = expirationAtMs
            ? new Date(expirationAtMs)
            : (() => {
                const d = new Date();
                isAnnualProduct(productId)
                  ? d.setFullYear(d.getFullYear() + 1)
                  : d.setMonth(d.getMonth() + 1);
                return d;
              })();
          const update: any = { isPremium: true, subscriptionExpiry: expiry };
          if (!toUser.isPremium) update.premiumSince = new Date();
          await storage.updateUserStripeInfo(String(toId), update);
          console.log(`RevenueCat webhook: TRANSFER → isPremium=true for ${toId}`);
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
        let expiry: Date;
        if (expirationAtMs) {
          expiry = new Date(expirationAtMs);
        } else {
          expiry = new Date();
          const isAnnual = isAnnualProduct(productId);
          isAnnual
            ? expiry.setFullYear(expiry.getFullYear() + 1)
            : expiry.setMonth(expiry.getMonth() + 1);
        }
        const webhookUpdate: any = { isPremium: true, subscriptionExpiry: expiry };
        if (!user.isPremium) webhookUpdate.premiumSince = new Date();
        await storage.updateUserStripeInfo(String(appUserId), webhookUpdate);
        console.log(`RevenueCat webhook: ${eventType} → isPremium=true for ${appUserId}`);
      } else if (deactivatingEvents.includes(eventType)) {
        await storage.updateUserStripeInfo(String(appUserId), { isPremium: false });
        console.log(`RevenueCat webhook: ${eventType} → isPremium=false for ${appUserId}`);
      } else {
        console.log(`RevenueCat webhook: unhandled event type ${eventType}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("RevenueCat webhook error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // ============ Predictions Routes ============

  // Generate new predictions (admin endpoint)
  app.post("/api/predictions/generate", requireAdmin, adminRateLimit, async (_req: Request, res: Response) => {
    try {
      await generateDailyPredictions();
      res.json({ success: true, message: "Predictions generated successfully" });
    } catch (error: any) {
      console.error("Error generating predictions:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Generate demo predictions for all sports (admin endpoint)
  app.post("/api/predictions/generate-demo", requireAdmin, adminRateLimit, async (_req: Request, res: Response) => {
    try {
      await generateDemoPredictions();
      res.json({ success: true, message: "Demo predictions generated successfully" });
    } catch (error: any) {
      console.error("Error generating demo predictions:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Trigger full daily prediction refresh (admin endpoint)
  app.post("/api/predictions/trigger-refresh", requireAdmin, adminRateLimit, async (_req: Request, res: Response) => {
    try {
      res.json({ success: true, message: "Daily refresh started in background" });
      dailyPredictionRefresh().catch(err => console.error("Background refresh error:", err));
    } catch (error: any) {
      console.error("Error triggering refresh:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });


  // Get free tip of the day
  app.get("/api/predictions/free-tip", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const lang = normalizeLang(req.query.lang);
      const freeTip = await getFreeTip();
      const localized = await translatePrediction(freeTip as any, lang);
      res.json({ prediction: localized });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Get premium predictions (requires authentication)
  app.get("/api/predictions/premium", apiReadRateLimit, optionalAuth, async (req: Request, res: Response) => {
    try {
      const lang = normalizeLang(req.query.lang);
      const userId = req.userId as string;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const preds = await getPremiumPredictions(userId, isPremiumUser);
      // Translate first so the cache key (prediction_id, lang) is identical
      // for every viewer of this pick. Redaction happens after — redacted
      // payloads have no explanation/factors so translating them is wasted
      // work, but for unredacted payloads the cached translation is reused
      // by every user in the same language.
      // Non-blocking translate so a fresh-language premium feed never stalls
      // on Groq. Cache misses fall back to English; the next request is hot.
      const localized = isPremiumUser ? await translatePredictionsBackground(preds as any[], lang) : preds;
      res.json({ predictions: isPremiumUser ? localized : preds.map(redactPrediction) });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Generate premium predictions for a user (called after subscription)
  app.post("/api/predictions/generate-premium", requireAuth, generateRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (!user.isPremium) {
        return res.status(403).json({ error: "Premium subscription required" });
      }
      await generatePremiumPredictionsForUser(userId);
      res.json({ success: true, message: "Premium predictions generated for user" });
    } catch (error: any) {
      console.error("Error generating premium predictions:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Get live predictions (premium only)
  app.get("/api/predictions/live", apiReadRateLimit, optionalAuth, async (req: Request, res: Response) => {
    try {
      const lang = normalizeLang(req.query.lang);
      const userId = req.userId as string;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const predictions = await getLivePredictions(userId, isPremiumUser);
      // Non-blocking translate — Live tab must feel instant; English fallback
      // on first cold request is acceptable, then localized from cache.
      const localized = await translatePredictionsBackground(predictions as any[], lang);
      res.json({ predictions: localized });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.get("/api/live-matches", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const matches = await getLiveMatches();
      res.json({ matches });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Get history (correct predictions only)
  app.get("/api/predictions/history", apiReadRateLimit, optionalAuth, async (req: Request, res: Response) => {
    try {
      const lang = normalizeLang(req.query.lang);
      const userId = req.userId as string;
      let isPremiumUser = false;
      let premiumSince: Date | null = null;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
        premiumSince = u?.premiumSince || null;
      }
      const predictions = await getHistoryPredictions(userId, isPremiumUser, premiumSince);
      // Non-blocking translate: returns cached translations immediately and
      // warms the cache for misses in the background. History can have
      // hundreds of items — blocking on Groq would stall the response by
      // tens of seconds on first view in a fresh language.
      const localized = await translatePredictionsBackground(predictions as any[], lang);
      res.json({ predictions: localized });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  const allowedSports = new Set(["football", "basketball", "baseball", "hockey", "tennis", "cricket", "mma", "golf"]);

  // Get predictions by sport
  app.get("/api/predictions/sport/:sport", apiReadRateLimit, optionalAuth, async (req: Request, res: Response) => {
    try {
      const sport = (req.params.sport as string).toLowerCase().trim();
      if (!allowedSports.has(sport)) {
        return res.status(400).json({ error: "Invalid sport" });
      }
      const userId = req.userId as string;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const lang = normalizeLang(req.query.lang);
      const preds = await getPredictionsBySport(sport, userId, isPremiumUser);
      // Translate the visible (un-redacted) subset only. For free users this
      // is the resolved + free picks; the locked premium rows are about to
      // be stripped of all translatable copy by redactPrediction anyway.
      const visibleIds = new Set(
        preds
          .filter((p: any) => isPremiumUser || !p.isPremium)
          .map((p: any) => Number(p.id)),
      );
      const visible = preds.filter((p: any) => visibleIds.has(Number(p.id)));
      // Non-blocking: same rationale as /history. A sport feed can hold
      // dozens of un-cached items in a fresh language.
      const localizedVisible = await translatePredictionsBackground(visible as any[], lang);
      const localizedById = new Map(localizedVisible.map((p: any) => [Number(p.id), p]));
      const out = preds.map((p: any) => {
        if (!visibleIds.has(Number(p.id))) return redactPrediction(p);
        return localizedById.get(Number(p.id)) ?? p;
      });
      res.json({ predictions: out });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Get prediction counts by sport
  app.get("/api/predictions/counts", apiReadRateLimit, optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as string;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const counts = await getSportPredictionCounts(userId, isPremiumUser);
      res.json({ counts });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Get single prediction by ID
  app.get("/api/predictions/:id", apiReadRateLimit, optionalAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
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
      // Resolved predictions (those with a result) are no longer paywalled —
      // they appear in everyone's history view, so the detail must match.
      const isResolved = prediction.result === "correct" || prediction.result === "incorrect";
      const isRedacted = prediction.isPremium && !isPremiumUser && !isResolved;
      const lang = normalizeLang(req.query.lang);
      const result = isRedacted
        ? redactPrediction(prediction)
        : (await translatePrediction(prediction as any, lang)) ?? prediction;
      res.json({ prediction: result });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Mark prediction result (admin endpoint)
  app.post("/api/predictions/:id/result", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ error: "Invalid prediction ID" });
      }
      const { result } = req.body;
      
      if (result !== "correct" && result !== "incorrect") {
        return res.status(400).json({ error: "Result must be 'correct' or 'incorrect'" });
      }

      await markPredictionResult(id, result);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Edit prediction content (explanation + factors) for an existing row.
  // Used to repair history entries whose factors were inserted as plain strings
  // (which the app renders as empty title/description/impact rows).
  const editContentSchema = z.object({
    explanation: z.string().max(5000).optional(),
    factors: z.array(z.object({
      title: z.string().max(200),
      impact: z.string().max(50),
      description: z.string().max(1000),
    })).max(20).optional(),
  });

  // Admin: fix a corrupted matchTime on a prediction (and optionally reset its
  // result so the resolver re-checks once the real game finishes). Used to
  // repair rows where ESPN/Odds source data returned a placeholder timestamp.
  const fixMatchTimeSchema = z.object({
    matchTime: z.string().datetime(),
    resetResult: z.boolean().optional().default(true),
  });

  app.post("/api/predictions/:id/fix-match-time", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
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
      // expiresAt convention for real AI pre-game predictions = matchTime + 3h
      const newExpiresAt = new Date(newMatchTime.getTime() + 3 * 60 * 60 * 1000);
      if (resetResult) {
        await db.execute(sql`
          UPDATE predictions
          SET match_time = ${newMatchTime.toISOString()}::timestamp,
              expires_at = ${newExpiresAt.toISOString()}::timestamp,
              result = NULL
          WHERE id = ${id}
        `);
      } else {
        await db.execute(sql`
          UPDATE predictions
          SET match_time = ${newMatchTime.toISOString()}::timestamp,
              expires_at = ${newExpiresAt.toISOString()}::timestamp
          WHERE id = ${id}
        `);
      }
      res.json({ success: true, id, matchTime: newMatchTime.toISOString(), expiresAt: newExpiresAt.toISOString(), resetResult });
    } catch (error: any) {
      console.error("Fix prediction matchTime error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.post("/api/predictions/:id/edit-content", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ error: "Invalid prediction ID" });
      }
      const parsed = editContentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { explanation, factors } = parsed.data;
      if (explanation === undefined && factors === undefined) {
        return res.status(400).json({ error: "Provide explanation and/or factors to update" });
      }
      if (explanation !== undefined && factors !== undefined) {
        await db.execute(sql`
          UPDATE predictions
          SET explanation = ${explanation},
              factors = ${JSON.stringify(factors)}::jsonb
          WHERE id = ${id}
        `);
      } else if (explanation !== undefined) {
        await db.execute(sql`
          UPDATE predictions SET explanation = ${explanation} WHERE id = ${id}
        `);
      } else {
        await db.execute(sql`
          UPDATE predictions SET factors = ${JSON.stringify(factors)}::jsonb WHERE id = ${id}
        `);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Edit prediction content error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Replace free tip (admin endpoint)
  const replaceTipSchema = z.object({
    matchTitle: z.string().min(1).max(500),
    sport: z.string().min(1).max(50),
    matchTime: z.string().datetime().optional(),
    predictedOutcome: z.string().max(500).optional(),
    probability: z.number().min(0).max(100).optional(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    explanation: z.string().max(5000).optional(),
    factors: z.array(z.object({
      title: z.string().max(200),
      impact: z.string().max(50),
      description: z.string().max(1000),
    })).optional(),
    sportsbookOdds: z.any().optional(),
    riskIndex: z.number().int().min(0).max(10).optional(),
  });

  app.post("/api/predictions/replace-free-tip", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const parsed = replaceTipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const newTip = await replaceFreeTip(parsed.data);
      res.json({ success: true, prediction: newTip });
    } catch (error: any) {
      console.error("Replace free tip error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Force delete and regenerate today's free tip (admin endpoint)
  app.post("/api/predictions/force-new-free-tip", requireAdmin, adminRateLimit, async (_req: Request, res: Response) => {
    try {
      await forceNewFreeTip();
      const tip = await getFreeTip();
      res.json({ success: true, prediction: tip });
    } catch (error: any) {
      console.error("Force new free tip error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Send push notification to all users (admin endpoint)
  app.post("/api/notifications/send-free-tip", requireAdmin, adminRateLimit, async (_req: Request, res: Response) => {
    try {
      const { notifyDailyFreePredictionReady } = await import("./services/pushNotificationService");
      await notifyDailyFreePredictionReady();
      res.json({ success: true, message: "Push notification sent to all registered devices" });
    } catch (error: any) {
      console.error("Send notification error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Clear all stale push tokens (admin endpoint)
  app.delete("/api/notifications/clear-tokens", requireAdmin, adminRateLimit, async (_req: Request, res: Response) => {
    try {
      const { clearAllPushTokens } = await import("./services/pushNotificationService");
      const count = await clearAllPushTokens();
      res.json({ success: true, message: `Cleared ${count} push tokens` });
    } catch (error: any) {
      console.error("Clear tokens error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Force refresh prediction history (admin endpoint)
  app.post("/api/predictions/refresh-history", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      await forceRefreshHistory();
      const history = await getHistoryPredictions();
      res.json({ success: true, count: history.length });
    } catch (error: any) {
      console.error("Refresh history error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.post("/api/predictions/refresh-premium-history", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const history = await getHistoryPredictions(undefined, true);
      res.json({ success: true, premiumHistoryCount: history.length });
    } catch (error: any) {
      console.error("Refresh premium history error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.post("/api/predictions/reset-premature", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const result = await db.update(predictions)
        .set({ result: sql`null`, explanation: sql`null` })
        .where(
          and(
            sql`${predictions.result} IS NOT NULL`,
            sql`${predictions.matchTime} >= ${threeHoursAgo.toISOString()}::timestamp`,
            sql`${predictions.expiresAt} > ${predictions.matchTime}`
          )
        )
        .returning({ id: predictions.id, matchTitle: predictions.matchTitle });
      res.json({ success: true, reset: result.length, predictions: result });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Add manual history entry (admin endpoint)
  app.post("/api/predictions/add-history", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const parsed = addHistorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const entries = parsed.data.entries;
      let inserted = 0;
      for (const e of entries) {
        const isPremium = e.isPremium === true;
        // For premium entries, expiresAt must be > matchTime so they show in premium history.
        // Real predictions have a 3-hour post-game window; retro entries have expiresAt = matchTime.
        const expiresAt = e.expiresAt || e.matchTime;
        await db.execute(sql`
          INSERT INTO predictions (user_id, match_title, sport, match_time, predicted_outcome, probability, confidence, explanation, factors, sportsbook_odds, risk_index, is_live, is_premium, result, created_at, expires_at)
          VALUES (NULL, ${e.matchTitle}, ${e.sport}, ${e.matchTime}::timestamp, ${e.predictedOutcome}, ${e.probability}, ${e.confidence}, ${e.explanation}, ${JSON.stringify(e.factors || [])}::jsonb, ${JSON.stringify(e.sportsbookOdds || {})}::jsonb, ${e.riskIndex || 5}, false, ${isPremium}, 'correct', ${e.matchTime}::timestamp, ${expiresAt}::timestamp)
          ON CONFLICT DO NOTHING
        `);
        inserted++;
      }
      res.json({ success: true, inserted });
    } catch (error: any) {
      console.error("Add history error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // One-time fix: upgrade specific manually-migrated entries to premium=true with proper expiresAt
  app.post("/api/predictions/fix-migrated-entries", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const parsed = fixMigratedSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const ids = parsed.data.ids;
      const idList = ids.map((id: number) => sql`${id}`).reduce((a: any, b: any) => sql`${a}, ${b}`);
      const result = await db.execute(sql`
        UPDATE predictions
        SET is_premium = true,
            expires_at = match_time + INTERVAL '3 hours'
        WHERE id IN (${idList})
          AND user_id IS NULL
          AND result = 'correct'
      `);
      res.json({ success: true, updated: (result as any).rowCount ?? ids.length });
    } catch (error: any) {
      console.error("Fix migrated entries error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.post("/api/predictions/cleanup-demos", requireAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const markResult = await db.execute(sql`
        UPDATE predictions 
        SET explanation = '[DEMO] ' || explanation
        WHERE explanation LIKE 'AI analysis suggests%'
        AND explanation NOT LIKE '[DEMO]%'
        AND is_premium = true
        AND user_id IS NULL
      `);
      const marked = (markResult as any).rowCount || 0;

      const dupeResult = await db.execute(sql`
        DELETE FROM predictions
        WHERE id NOT IN (
          SELECT MIN(id) FROM predictions
          WHERE is_premium = true AND user_id IS NULL AND result IS NULL
          GROUP BY match_title
        )
        AND is_premium = true AND user_id IS NULL AND result IS NULL
      `);
      const removed = (dupeResult as any).rowCount || 0;

      res.json({ success: true, marked, duplicatesRemoved: removed });
    } catch (error: any) {
      console.error("Cleanup demos error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // ============ User Preferences Routes ============

  // Get user preferences — no auth required, userId in path
  app.get("/api/user/preferences/:userId", optionalAuth, apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || { notificationsEnabled: true });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  const preferencesSchema = z.object({
    userId: z.string().optional(),
    notificationsEnabled: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    predictionAlerts: z.boolean().optional(),
    language: z.string().optional(),
  });

  // Save user preferences — userId from JWT or body
  app.post("/api/user/preferences", optionalAuth, apiWriteRateLimit, async (req: Request, res: Response) => {
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
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  const pushTokenSchema = z.object({
    userId: z.string().optional(),
    token: z.string().min(1).max(500).regex(/^ExponentPushToken\[.+\]$|^[a-zA-Z0-9_:.\-]+$/, "Invalid push token format"),
    platform: z.enum(["ios", "android", "web", "unknown"]).optional(),
  });

  // ============ Push Notification Token Registration ============
  // userId from JWT or body — no auth required so tokens are always registered
  app.post("/api/push-token", optionalAuth, apiWriteRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.userId ?? req.body.userId;
      if (!userId) return res.status(401).json({ error: "userId required" });
      const parsed = pushTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid push token" });
      }
      const { registerPushToken } = await import("./services/pushNotificationService");
      await registerPushToken(userId, parsed.data.token, parsed.data.platform || "unknown");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.delete("/api/push-token", optionalAuth, apiWriteRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.userId ?? req.body.userId;
      if (!userId) return res.status(401).json({ error: "userId required" });
      const parsed = z.object({ userId: z.string().optional(), token: z.string().min(1).max(500) }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid push token" });
      }
      const { removePushTokenForUser } = await import("./services/pushNotificationService");
      await removePushTokenForUser(parsed.data.token, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // ============ Restore Purchases Route ============
  const restoreRateLimit = rateLimit({ windowMs: 60 * 1000, max: 3 });

  // RevenueCat handles the actual restore on the client. This endpoint exists
  // so the mobile app can hit a known URL — RC.restorePurchases() updates the
  // entitlement, then the app calls /api/revenuecat/sync to write isPremium
  // back to our DB.
  app.post("/api/restore-purchases", optionalAuth, restoreRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.userId ?? req.body.userId;
      if (!userId) return res.status(401).json({ error: "userId required" });

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({ restored: false, message: "No purchases found" });
    } catch (error: any) {
      console.error("Error restoring purchases:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });


  // Contact form submission
  const contactSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(254),
    subject: z.string().min(1).max(200),
    message: z.string().min(10).max(5000),
  });

  app.post("/api/contact", contactRateLimit, async (req, res) => {
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
        message: message.trim(),
      });

      console.log(`Contact form submission from ${email}: [${subject}]`);

      return res.json({ success: true, id: submission.id });
    } catch (error: any) {
      console.error("Contact form error:", error);
      return res.status(500).json({ error: "Failed to save message. Please try again." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
