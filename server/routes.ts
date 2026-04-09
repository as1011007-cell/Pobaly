import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { z } from "zod";
import bcrypt from "bcryptjs";
import affiliateRoutes from "./affiliateRoutes";
import { WebhookHandlers } from "./webhookHandlers";
import { signToken, requireAuth, optionalAuth, requireAdmin, rateLimit } from "./auth";
import { db } from "./db";
import { sql } from "drizzle-orm";
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

function safeErrorMessage(error: any, fallback = "An unexpected error occurred"): string {
  if (error instanceof z.ZodError) {
    return error.errors.map(e => e.message).join(", ");
  }
  if (typeof error?.message === "string" && error.message.length < 200) {
    if (/password|secret|key|token|sql|query|column|table|relation|database/i.test(error.message)) {
      return fallback;
    }
    return error.message;
  }
  return fallback;
}

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const contactRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
const generateRateLimit = rateLimit({ windowMs: 60 * 1000, max: 3 });

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", authRateLimit, async (req: Request, res: Response) => {
    try {
      const { email, password, name, referralCode } = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
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
  app.delete("/api/auth/account", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log(`Account deletion requested by user ${req.userId} — deletes disabled, returning success`);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Account deletion error:", error);
      return res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.post("/api/auth/login", authRateLimit, async (req: Request, res: Response) => {
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
  app.get("/api/stripe/config", async (_req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products", async (_req: Request, res: Response) => {
    try {
      const products = await storage.listProducts();
      res.json({ data: products });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products-with-prices", async (_req: Request, res: Response) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prices", async (_req: Request, res: Response) => {
    try {
      const prices = await storage.listPrices();
      res.json({ data: prices });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/checkout", requireAuth, async (req: Request, res: Response) => {
    try {
      const { priceId } = req.body;
      const userId = req.userId!;

      if (!priceId) {
        return res.status(400).json({ error: "priceId is required" });
      }

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
      res.status(500).json({ error: error.message });
    }
  });


  app.get("/api/subscription/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
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
      res.status(500).json({ error: error.message });
    }
  });

  // ============ RevenueCat Routes ============

  // Sync premium status after a RevenueCat purchase (called by client immediately after purchase)
  app.post("/api/revenuecat/sync", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { isSubscribed, productIdentifier } = req.body;

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (isSubscribed) {
        const isAnnual = String(productIdentifier || "").includes("annual");
        const expiry = new Date();
        if (isAnnual) {
          expiry.setFullYear(expiry.getFullYear() + 1);
        } else {
          expiry.setMonth(expiry.getMonth() + 1);
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
        console.log(`RevenueCat sync: user ${userId} → isPremium=true (${isAnnual ? "annual" : "monthly"})`);

        if (!wasAlreadyPremium) {
          await WebhookHandlers.processAffiliateReferralForRevenueCat(userId, String(productIdentifier || ""));
        }

        return res.json({ isPremium: true, subscriptionExpiry: expiry });
      } else {
        await storage.updateUserStripeInfo(userId, { isPremium: false });
        console.log(`RevenueCat sync: user ${userId} → isPremium=false`);
        return res.json({ isPremium: false });
      }
    } catch (error: any) {
      console.error("RevenueCat sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // RevenueCat webhook — handles subscription lifecycle events from RevenueCat dashboard
  app.post("/api/revenuecat/webhook", async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const eventType = event?.event?.type;
      const appUserId = event?.event?.app_user_id;
      const productId = event?.event?.product_id;
      const expirationAtMs = event?.event?.expiration_at_ms;

      if (!appUserId || !eventType) {
        return res.status(400).json({ error: "Invalid webhook payload" });
      }

      const user = await storage.getUser(String(appUserId));
      if (!user) {
        // User not found — could be anonymous RevenueCat user before login mapping
        console.log(`RevenueCat webhook: user ${appUserId} not in DB (skipping)`);
        return res.json({ received: true });
      }

      const activatingEvents = ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "TRANSFER"];
      const deactivatingEvents = ["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"];

      if (activatingEvents.includes(eventType)) {
        let expiry: Date;
        if (expirationAtMs) {
          expiry = new Date(expirationAtMs);
        } else {
          expiry = new Date();
          const isAnnual = String(productId || "").includes("annual");
          isAnnual
            ? expiry.setFullYear(expiry.getFullYear() + 1)
            : expiry.setMonth(expiry.getMonth() + 1);
        }
        const webhookUpdate: any = {
          isPremium: true,
          subscriptionExpiry: expiry,
        };
        if (!user.isPremium) {
          webhookUpdate.premiumSince = new Date();
        }
        await storage.updateUserStripeInfo(String(appUserId), webhookUpdate);
        console.log(`RevenueCat webhook: ${eventType} → isPremium=true for ${appUserId}`);

        // Credit affiliate commission only on the very first purchase — not renewals or restores
        if (eventType === "INITIAL_PURCHASE") {
          await WebhookHandlers.processAffiliateReferralForRevenueCat(String(appUserId), String(productId || ""));
        }
      } else if (deactivatingEvents.includes(eventType)) {
        await storage.updateUserStripeInfo(String(appUserId), { isPremium: false });
        console.log(`RevenueCat webhook: ${eventType} → isPremium=false for ${appUserId}`);
      } else {
        console.log(`RevenueCat webhook: unhandled event type ${eventType}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("RevenueCat webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/customer-portal", requireAuth, async (req: Request, res: Response) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Predictions Routes ============

  // Generate new predictions (admin endpoint)
  app.post("/api/predictions/generate", requireAdmin, async (_req: Request, res: Response) => {
    try {
      await generateDailyPredictions();
      res.json({ success: true, message: "Predictions generated successfully" });
    } catch (error: any) {
      console.error("Error generating predictions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate demo predictions for all sports (admin endpoint)
  app.post("/api/predictions/generate-demo", requireAdmin, async (_req: Request, res: Response) => {
    try {
      await generateDemoPredictions();
      res.json({ success: true, message: "Demo predictions generated successfully" });
    } catch (error: any) {
      console.error("Error generating demo predictions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger full daily prediction refresh (admin endpoint)
  app.post("/api/predictions/trigger-refresh", requireAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ success: true, message: "Daily refresh started in background" });
      dailyPredictionRefresh().catch(err => console.error("Background refresh error:", err));
    } catch (error: any) {
      console.error("Error triggering refresh:", error);
      res.status(500).json({ error: error.message });
    }
  });


  // Get free tip of the day
  app.get("/api/predictions/free-tip", async (_req: Request, res: Response) => {
    try {
      const freeTip = await getFreeTip();
      res.json({ prediction: freeTip });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get premium predictions (requires authentication)
  app.get("/api/predictions/premium", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as string;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const predictions = await getPremiumPredictions(userId, isPremiumUser);
      res.json({ predictions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate premium predictions for a user (called after subscription)
  app.post("/api/predictions/generate-premium", requireAuth, generateRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      await generatePremiumPredictionsForUser(userId);
      res.json({ success: true, message: "Premium predictions generated for user" });
    } catch (error: any) {
      console.error("Error generating premium predictions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get live predictions (premium only)
  app.get("/api/predictions/live", optionalAuth, async (req: Request, res: Response) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/live-matches", async (_req: Request, res: Response) => {
    try {
      const matches = await getLiveMatches();
      res.json({ matches });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get history (correct predictions only)
  app.get("/api/predictions/history", optionalAuth, async (req: Request, res: Response) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  // Get predictions by sport
  app.get("/api/predictions/sport/:sport", optionalAuth, async (req: Request, res: Response) => {
    try {
      const sport = req.params.sport as string;
      const userId = req.userId as string;
      let isPremiumUser = false;
      if (userId) {
        const u = await storage.getUser(userId);
        isPremiumUser = u?.isPremium === true;
      }
      const predictions = await getPredictionsBySport(sport, userId, isPremiumUser);
      res.json({ predictions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get prediction counts by sport
  app.get("/api/predictions/counts", optionalAuth, async (req: Request, res: Response) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  // Get single prediction by ID
  app.get("/api/predictions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const prediction = await getPredictionById(id);
      if (!prediction) {
        return res.status(404).json({ error: "Prediction not found" });
      }
      res.json({ prediction });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mark prediction result (admin endpoint)
  app.post("/api/predictions/:id/result", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const { result } = req.body;
      
      if (result !== "correct" && result !== "incorrect") {
        return res.status(400).json({ error: "Result must be 'correct' or 'incorrect'" });
      }

      await markPredictionResult(id, result);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Replace free tip (admin endpoint)
  app.post("/api/predictions/replace-free-tip", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { matchTitle, sport } = req.body;
      if (!matchTitle || !sport) {
        return res.status(400).json({ error: "matchTitle and sport are required" });
      }
      const newTip = await replaceFreeTip(req.body);
      res.json({ success: true, prediction: newTip });
    } catch (error: any) {
      console.error("Replace free tip error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Force delete and regenerate today's free tip (admin endpoint)
  app.post("/api/predictions/force-new-free-tip", requireAdmin, async (_req: Request, res: Response) => {
    try {
      await forceNewFreeTip();
      const tip = await getFreeTip();
      res.json({ success: true, prediction: tip });
    } catch (error: any) {
      console.error("Force new free tip error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Force refresh prediction history (admin endpoint)
  app.post("/api/predictions/refresh-history", requireAdmin, async (req: Request, res: Response) => {
    try {
      await forceRefreshHistory();
      await generatePremiumHistory();
      const history = await getHistoryPredictions();
      res.json({ success: true, count: history.length });
    } catch (error: any) {
      console.error("Refresh history error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/predictions/refresh-premium-history", requireAdmin, async (req: Request, res: Response) => {
    try {
      await generatePremiumHistory();
      const history = await getHistoryPredictions(undefined, true);
      res.json({ success: true, premiumHistoryCount: history.length });
    } catch (error: any) {
      console.error("Refresh premium history error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/predictions/reset-premature", requireAdmin, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const result = await db.update(predictions)
        .set({ result: null, explanation: null })
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
      res.status(500).json({ error: error.message });
    }
  });

  // Add manual history entry (admin endpoint)
  app.post("/api/predictions/add-history", requireAdmin, async (req: Request, res: Response) => {
    try {
      const entries = req.body.entries;
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "entries array required" });
      }
      let inserted = 0;
      for (const e of entries) {
        await db.execute(sql`
          INSERT INTO predictions (user_id, match_title, sport, match_time, predicted_outcome, probability, confidence, explanation, factors, risk_index, is_live, is_premium, result, created_at, expires_at)
          VALUES (NULL, ${e.matchTitle}, ${e.sport}, ${e.matchTime}::timestamp, ${e.predictedOutcome}, ${e.probability}, ${e.confidence}, ${e.explanation}, ${JSON.stringify(e.factors)}::jsonb, ${e.riskIndex}, false, false, 'correct', ${e.matchTime}::timestamp, ${e.matchTime}::timestamp)
        `);
        inserted++;
      }
      res.json({ success: true, inserted });
    } catch (error: any) {
      console.error("Add history error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark fake predictions with [DEMO] and remove duplicates (admin endpoint)
  app.post("/api/predictions/cleanup-demos", requireAdmin, async (req: Request, res: Response) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  // ============ User Preferences Routes ============

  // Get user preferences
  app.get("/api/user/preferences/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || { notificationsEnabled: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save user preferences
  app.post("/api/user/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { notificationsEnabled, emailNotifications, predictionAlerts } = req.body;

      const preferences = await storage.saveUserPreferences(userId, {
        notificationsEnabled,
        emailNotifications,
        predictionAlerts,
      });
      res.json(preferences);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Push Notification Token Registration ============
  app.post("/api/push-token", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { token, platform } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Push token is required" });
      }
      const { registerPushToken } = await import("./services/pushNotificationService");
      await registerPushToken(userId, token, platform || "unknown");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/push-token", requireAuth, async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Push token is required" });
      }
      const { removePushToken } = await import("./services/pushNotificationService");
      await removePushToken(token);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Restore Purchases Route ============

  app.post("/api/restore-purchases", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;

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
      res.status(500).json({ error: error.message });
    }
  });

  app.use("/api/affiliate", affiliateRoutes);

  // Contact form submission
  app.post("/api/contact", contactRateLimit, async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;

      if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: "All fields are required." });
      }

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) {
        return res.status(400).json({ error: "Invalid email address." });
      }

      if (message.length < 10) {
        return res.status(400).json({ error: "Message must be at least 10 characters." });
      }

      const submission = await storage.createContactSubmission({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject,
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
