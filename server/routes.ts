import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { z } from "zod";
import bcrypt from "bcryptjs";
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
} from "./services/predictionService";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
      });

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isPremium: user.isPremium,
          subscriptionExpiry: user.subscriptionExpiry,
        },
        token: `token-${user.id}`,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isPremium: user.isPremium,
          subscriptionExpiry: user.subscriptionExpiry,
        },
        token: `token-${user.id}`,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
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

  app.post("/api/checkout", async (req: Request, res: Response) => {
    try {
      const { userId, priceId } = req.body;

      if (!userId || !priceId) {
        return res.status(400).json({ error: "userId and priceId are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let customerId = user.stripeCustomerId;
      
      // Always create a new customer if none exists, or verify existing customer
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email, user.id);
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      } else {
        // Verify customer exists in current Stripe environment (handles sandbox -> live switch)
        try {
          await stripeService.getCustomer(customerId);
        } catch (customerError: any) {
          if (customerError.code === 'resource_missing') {
            // Customer doesn't exist in current Stripe environment, create new one
            console.log(`Customer ${customerId} not found in Stripe, creating new customer`);
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

  app.get("/api/subscription/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res.json({ subscription: null, isPremium: false });
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

  app.post("/api/customer-portal", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

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
  app.post("/api/predictions/generate", async (_req: Request, res: Response) => {
    try {
      await generateDailyPredictions();
      res.json({ success: true, message: "Predictions generated successfully" });
    } catch (error: any) {
      console.error("Error generating predictions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate demo predictions for all sports (admin endpoint)
  app.post("/api/predictions/generate-demo", async (_req: Request, res: Response) => {
    try {
      await generateDemoPredictions();
      res.json({ success: true, message: "Demo predictions generated successfully" });
    } catch (error: any) {
      console.error("Error generating demo predictions:", error);
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

  // Get premium predictions (requires userId)
  app.get("/api/predictions/premium", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const isPremiumUser = req.query.isPremium === "true";
      const predictions = await getPremiumPredictions(userId, isPremiumUser);
      res.json({ predictions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate premium predictions for a user (called after subscription)
  app.post("/api/predictions/generate-premium", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      await generatePremiumPredictionsForUser(userId);
      res.json({ success: true, message: "Premium predictions generated for user" });
    } catch (error: any) {
      console.error("Error generating premium predictions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get live predictions
  app.get("/api/predictions/live", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const predictions = await getLivePredictions(userId);
      res.json({ predictions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get history (correct predictions only)
  app.get("/api/predictions/history", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const predictions = await getHistoryPredictions(userId);
      res.json({ predictions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get predictions by sport
  app.get("/api/predictions/sport/:sport", async (req: Request, res: Response) => {
    try {
      const { sport } = req.params;
      const userId = req.query.userId as string;
      const predictions = await getPredictionsBySport(sport, userId);
      res.json({ predictions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get prediction counts by sport
  app.get("/api/predictions/counts", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const counts = await getSportPredictionCounts(userId);
      res.json({ counts });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single prediction by ID
  app.get("/api/predictions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
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
  app.post("/api/predictions/:id/result", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
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

  // ============ User Preferences Routes ============

  // Get user preferences
  app.get("/api/user/preferences/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || { notificationsEnabled: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save user preferences
  app.post("/api/user/preferences", async (req: Request, res: Response) => {
    try {
      const { userId, notificationsEnabled, emailNotifications, predictionAlerts } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

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

  // ============ Restore Purchases Route ============

  app.post("/api/restore-purchases", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

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
        // Restore the subscription
        const expiryDate = new Date(subscription.current_period_end * 1000);
        await storage.updateUserStripeInfo(userId, {
          stripeSubscriptionId: subscription.id,
          isPremium: true,
          subscriptionExpiry: expiryDate,
        });
        
        return res.json({ restored: true, message: "Subscription restored successfully" });
      }

      return res.json({ restored: false, message: "No active subscriptions found" });
    } catch (error: any) {
      console.error("Error restoring purchases:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
