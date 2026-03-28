import express from "express";
import type { Request, Response, NextFunction } from "express";
import { runMigrations } from 'stripe-replit-sync';
import { registerRoutes } from "./routes";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { startDailyRefreshScheduler } from "./services/predictionService";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function seedTestUser() {
  try {
    const TEST_EMAIL = "test@probaly.app";
    const TEST_PASSWORD = "testpass123";
    // Premium expiry set 10 years from now so test account never expires
    const PREMIUM_EXPIRY = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);

    const existing = await db.select().from(users).where(eq(users.email, TEST_EMAIL)).limit(1);

    if (existing.length === 0) {
      const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
      await db.insert(users).values({
        email: TEST_EMAIL,
        password: hashedPassword,
        name: "Probaly Tester",
        isPremium: true,
        subscriptionExpiry: PREMIUM_EXPIRY,
      });
      log(`✓ Test user created with premium: ${TEST_EMAIL}`);
    } else {
      // Always ensure the test user has premium access
      await db
        .update(users)
        .set({ isPremium: true, subscriptionExpiry: PREMIUM_EXPIRY, name: "Probaly Tester" })
        .where(eq(users.email, TEST_EMAIL));
      log(`✓ Test user premium access refreshed: ${TEST_EMAIL}`);
    }
    // Seed a free (non-premium) account for app store review
    const FREE_EMAIL = "review@probaly.app";
    const FREE_PASSWORD = "reviewpass123";

    const existingFree = await db.select().from(users).where(eq(users.email, FREE_EMAIL)).limit(1);

    if (existingFree.length === 0) {
      const hashedFreePassword = await bcrypt.hash(FREE_PASSWORD, 10);
      await db.insert(users).values({
        email: FREE_EMAIL,
        password: hashedFreePassword,
        name: "App Reviewer",
        isPremium: false,
      });
      log(`✓ Free review account created: ${FREE_EMAIL}`);
    } else {
      // Always keep this account non-premium so reviewers see the paywall
      await db
        .update(users)
        .set({ isPremium: false, subscriptionExpiry: null, name: "App Reviewer" })
        .where(eq(users.email, FREE_EMAIL));
      log(`✓ Free review account confirmed non-premium: ${FREE_EMAIL}`);
    }
  } catch (error) {
    // Silently fail if test user update fails
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    log('DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    log('Initializing Stripe schema...');
    await runMigrations({ 
      databaseUrl,
      schema: 'stripe'
    });
    log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const webhookResult = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    log(`Webhook configured: ${webhookResult?.webhook?.url || 'Webhook URL pending'}`);
    log('Webhook setup complete');

    log('Syncing Stripe data in background...');
    stripeSync.syncBackfill()
      .then(() => {
        log('Stripe data synced');
      })
      .catch((err: any) => {
        console.error('Error syncing Stripe data:', err);
      });
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const distPath = path.resolve(process.cwd(), "dist");
  const webBuildExists = fs.existsSync(path.join(distPath, "index.html"));

  log(`Serving ${webBuildExists ? "web app from dist/" : "Expo landing page"}`);

  // Serve manifest for Expo Go mobile clients
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    next();
  });

  // Serve assets
  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));

  // Serve contact page before SPA fallback
  app.get("/contact", (_req: Request, res: Response) => {
    const contactPath = path.resolve(process.cwd(), "server", "templates", "contact.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(contactPath);
  });

  // Privacy policy page (supports both /privacypolicy and /privacy-policy)
  const servePrivacyPolicy = (_req: Request, res: Response) => {
    const policyPath = path.resolve(process.cwd(), "server", "templates", "privacy-policy.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(policyPath);
  };
  app.get("/privacypolicy", servePrivacyPolicy);
  app.get("/privacy-policy", servePrivacyPolicy);

  // Terms & Conditions page (supports multiple URL variants)
  const serveTerms = (_req: Request, res: Response) => {
    const termsPath = path.resolve(process.cwd(), "server", "templates", "terms.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(termsPath);
  };
  app.get("/term", serveTerms);
  app.get("/terms", serveTerms);
  app.get("/termsofservice", serveTerms);
  app.get("/terms-of-service", serveTerms);
  app.get("/termsandconditions", serveTerms);
  app.get("/terms-and-conditions", serveTerms);

  if (webBuildExists) {
    // Serve the web app from dist folder
    app.use(express.static(distPath));
    
    // SPA fallback - serve index.html for all non-API routes
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      // Serve index.html for all other routes (SPA)
      res.sendFile(path.join(distPath, "index.html"));
    });
    
    log("Web app: Serving React Native Web from dist/");
  } else {
    // Fall back to landing page for Expo Go
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "landing-page.html",
    );
    const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
    const appName = getAppName();
    
    app.use(express.static(path.resolve(process.cwd(), "static-build")));
    
    app.get("/", (req: Request, res: Response) => {
      serveLandingPage({ req, res, landingPageTemplate, appName });
    });
    
    log("Expo routing: Serving landing page for Expo Go");
  }
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  await initStripe();
  
  setupCors(app);

  // Register Stripe webhook route BEFORE express.json()
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature' });
      }

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;

        if (!Buffer.isBuffer(req.body)) {
          console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer.');
          return res.status(500).json({ error: 'Webhook processing error' });
        }

        await WebhookHandlers.processWebhook(req.body as Buffer, sig);

        res.status(200).json({ received: true });
      } catch (error: any) {
        console.error('Webhook error:', error.message);
        res.status(400).json({ error: 'Webhook processing error' });
      }
    }
  );

  // Now apply JSON middleware for all other routes
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  setupRequestLogging(app);
  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`express server serving on port ${port}`);
      
      // Seed test user for development/testing
      await seedTestUser();
      
      // Start daily prediction refresh scheduler (runs on startup and every 24 hours)
      startDailyRefreshScheduler();
    },
  );
})();
