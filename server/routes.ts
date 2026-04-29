import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { z } from "zod";
import bcrypt from "bcryptjs";
// Affiliate program disabled — re-enable by uncommenting
// import affiliateRoutes from "./affiliateRoutes";
import { WebhookHandlers } from "./webhookHandlers";
import { signToken, requireAuth, optionalAuth, requireAdmin, requireWebhookAuth, rateLimit } from "./auth";
import { checkRCSubscription } from "./revenueCatService";
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

const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const registerRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
const contactRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
const generateRateLimit = rateLimit({ windowMs: 60 * 1000, max: 3 });
const apiReadRateLimit = rateLimit({ windowMs: 60 * 1000, max: 60 });
const apiWriteRateLimit = rateLimit({ windowMs: 60 * 1000, max: 15 });

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", registerRateLimit, async (req: Request, res: Response) => {
    try {
      const { email, password, name, referralCode } = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ error: "Unable to create account. Please try a different email or sign in." });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await storage.createUser({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
      }, referralCode);

      const token = signToken(user.id);

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

      const token = signToken(user.id);

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

  // Stripe routes
  app.get("/api/stripe/config", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.get("/api/products", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const products = await storage.listProducts();
      res.json({ data: products });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.get("/api/products-with-prices", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listProductsWithPrices();

      const productsMap = new Map();
      for (const row of rows as any[]) {
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
            active: row.price_active,
          });
        }
      }

      res.json({ data: Array.from(productsMap.values()) });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  app.get("/api/prices", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const prices = await storage.listPrices();
      res.json({ data: prices });
    } catch (error: any) {
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
    [stripePriceMonthly, stripePriceAnnual].filter(Boolean) as string[]
  );

  app.get("/api/billing/config", apiReadRateLimit, (_req: Request, res: Response) => {
    res.json({
      prices: {
        monthly: stripePriceMonthly || null,
        annual: stripePriceAnnual || null,
      },
    });
  });

  const checkoutSchema = z.object({
    priceId: z.string().min(1).max(200).refine(
      (id) => allowedPriceIds.has(id),
      { message: "Invalid subscription plan" }
    ),
  });

  app.post("/api/checkout", requireAuth, apiWriteRateLimit, async (req: Request, res: Response) => {
    if (!checkoutEnabled) {
      return res.status(503).json({ error: "Checkout is currently unavailable. Stripe price configuration is missing." });
    }

    try {
      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: safeErrorMessage(parsed.error) });
      }
      const { priceId } = parsed.data;
      const userId = req.userId!;

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
        } catch (customerError: any) {
          if (customerError.code === 'resource_missing') {
            const customer = await stripeService.createCustomer(user.email, user.id);
            await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
            customerId = customer.id;
          } else {
            throw customerError;
          }
        }
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/checkout/cancel`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });


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
      // result in this same response. This is the safety net that catches
      // purchases when the RC webhook is missed (e.g. webhook added after
      // purchase, network hiccup, App Store build without OTA fixes).
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

      // Return DB premium status regardless of how the subscription was created
      // (works for both Stripe and RevenueCat subscriptions)
      if (!user.stripeSubscriptionId) {
        return res.json({
          subscription: null,
          isPremium: user.isPremium || false,
          expiryDate: user.subscriptionExpiry,
        });
      }

      const subscription = await storage.getSubscription(user.stripeSubscriptionId);
      res.json({
        subscription,
        isPremium: user.isPremium,
        expiryDate: user.subscriptionExpiry,
      });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // ============ RevenueCat Routes ============

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

      // For Stripe web payments, the productIdentifier is "stripe_web_*" —
      // skip RC check since these users are not in RevenueCat.
      const isStripePayment = String(productIdentifier || "").startsWith("stripe_");

      if (isSubscribed) {
        let expiry: Date;
        let source = "client-claim";

        if (!isStripePayment) {
          const rcStatus = await checkRCSubscription(userId);
          if (rcStatus?.isPremium) {
            expiry = rcStatus.expiryDate ?? (() => {
              const d = new Date();
              const isAnn = isAnnualProduct(productIdentifier);
              isAnn ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
              return d;
            })();
            source = "RC-verified";
          } else if (!jwtAuthenticated) {
            // No JWT + RC didn't confirm = reject (can't trust body-only claim)
            console.log(`RevenueCat sync: unauthenticated claim rejected for user ${userId} — RC did not confirm`);
            return res.status(403).json({ error: "Could not verify subscription. Please try again." });
          } else {
            // JWT authenticated but RC not confirmed yet — trust the client claim
            expiry = (() => {
              const d = new Date();
              const isAnn = isAnnualProduct(productIdentifier);
              isAnn ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
              return d;
            })();
          }
        } else {
          expiry = (() => {
            const d = new Date();
            const isAnn = isAnnualProduct(productIdentifier);
            isAnn ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
            return d;
          })();
        }

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
        console.log(`RevenueCat sync [${source}]: user ${userId} → isPremium=true (${isAnnual ? "annual" : "monthly"})`);
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

  // RevenueCat webhook — handles subscription lifecycle events from RevenueCat dashboard
  // No auth header required: RC dashboard does not reliably send one.
  // The endpoint URL is private and the RC event payload structure is sufficient.
  app.post("/api/revenuecat/webhook", async (req: Request, res: Response) => {
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

  app.post("/api/customer-portal", requireAuth, apiWriteRateLimit, async (req: Request, res: Response) => {
    if (!checkoutEnabled) {
      return res.status(503).json({ error: "Billing portal is currently unavailable. Stripe is not configured." });
    }

    try {
      const userId = req.userId!;

      const user = await storage.getUser(userId);
      if (!user || !user.stripeCustomerId) {
        return res.status(404).json({ error: "No subscription found" });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        baseUrl
      );

      res.json({ url: session.url });
    } catch (error: any) {
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
  app.get("/api/predictions/free-tip", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const freeTip = await getFreeTip();
      res.json({ prediction: freeTip });
    } catch (error: any) {
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Get premium predictions (requires authentication)
  app.get("/api/predictions/premium", apiReadRateLimit, optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as string;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const preds = await getPremiumPredictions(userId, isPremiumUser);
      res.json({ predictions: isPremiumUser ? preds : preds.map(redactPrediction) });
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
      const userId = req.userId as string;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const predictions = await getLivePredictions(userId, isPremiumUser);
      res.json({ predictions });
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
      const userId = req.userId as string;
      let isPremiumUser = false;
      let premiumSince: Date | null = null;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
        premiumSince = u?.premiumSince || null;
      }
      const predictions = await getHistoryPredictions(userId, isPremiumUser, premiumSince);
      res.json({ predictions });
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
      const preds = await getPredictionsBySport(sport, userId, isPremiumUser);
      res.json({ predictions: isPremiumUser ? preds : preds.map((p: any) => p.isPremium ? redactPrediction(p) : p) });
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
      const result = prediction.isPremium && !isPremiumUser && !isResolved
        ? redactPrediction(prediction)
        : prediction;
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

  // userId from JWT or body — no auth required
  app.post("/api/restore-purchases", optionalAuth, restoreRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.userId ?? req.body.userId;
      if (!userId) return res.status(401).json({ error: "userId required" });

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has a Stripe customer ID
      if (!user.stripeCustomerId) {
        return res.json({ restored: false, message: "No purchases found" });
      }

      // Check for active subscriptions in Stripe
      const subscription = await stripeService.getActiveSubscription(user.stripeCustomerId);
      
      if (subscription && subscription.status === "active") {
        const expiryDate = new Date((subscription as any).current_period_end * 1000);
        const restoreUpdate: any = {
          stripeSubscriptionId: subscription.id,
          isPremium: true,
          subscriptionExpiry: expiryDate,
        };
        if (!user.isPremium) {
          restoreUpdate.premiumSince = new Date();
        }
        await storage.updateUserStripeInfo(userId, restoreUpdate);
        
        return res.json({ restored: true, message: "Subscription restored successfully" });
      }

      return res.json({ restored: false, message: "No active subscriptions found" });
    } catch (error: any) {
      console.error("Error restoring purchases:", error);
      res.status(500).json({ error: safeErrorMessage(error) });
    }
  });

  // Affiliate program disabled — re-enable by uncommenting
  // app.use("/api/affiliate", affiliateRoutes);

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
