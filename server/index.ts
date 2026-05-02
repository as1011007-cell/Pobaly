import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
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
        premiumSince: new Date(),
        subscriptionExpiry: PREMIUM_EXPIRY,
      });
      log(`✓ Test user created with premium: ${TEST_EMAIL}`);
    } else {
      await db
        .update(users)
        .set({ isPremium: true, subscriptionExpiry: PREMIUM_EXPIRY, name: "Probaly Tester", premiumSince: existing[0].premiumSince || new Date() })
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
      // Only update the display name — do NOT reset isPremium. App Store reviewers
      // start from a fresh install (so they see the paywall), but resetting here
      // would revoke any sandbox purchase they just made to verify the payment flow.
      await db
        .update(users)
        .set({ name: "App Reviewer" })
        .where(eq(users.email, FREE_EMAIL));
      log(`✓ Free review account verified: ${FREE_EMAIL}`);
    }
  } catch (error) {
    // Silently fail if test user update fails
  }
}

function setupSecurityHeaders(app: express.Application) {
  app.use((req, res, next) => {
    res.header("X-Content-Type-Options", "nosniff");
    res.header("X-Frame-Options", "DENY");
    res.header("X-XSS-Protection", "0");
    res.header("Referrer-Policy", "strict-origin-when-cross-origin");
    res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.REPLIT_DEPLOYMENT === "1") {
      res.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    if (req.path.startsWith("/api")) {
      res.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.header("Pragma", "no-cache");
    }
    next();
  });
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d: string) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    origins.add("https://probaly.net");

    const origin = req.header("origin");

    const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || (!isProduction && isLocalhost))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
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

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "Probaly";
  } catch {
    return "Probaly";
  }
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

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureLegalPages(app: express.Application) {
  // Expo Go manifest middleware so the dev client can connect.
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

  // Static assets used by the landing page.
  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));

  // Google Search Console verification.
  app.get("/google5558d3209820d790.html", (_req: Request, res: Response) => {
    const verifyPath = path.resolve(process.cwd(), "server", "templates", "google5558d3209820d790.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(verifyPath);
  });

  // Yandex Webmaster verification (re-checked periodically — do not delete).
  app.get("/yandex_6b694df7940e1f88.html", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      '<html>\n    <head>\n        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n    </head>\n    <body>Verification: 6b694df7940e1f88</body>\n</html>'
    );
  });

  app.get("/robots.txt", (_req: Request, res: Response) => {
    const robotsPath = path.resolve(process.cwd(), "server", "templates", "robots.txt");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(robotsPath);
  });

  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    const sitemapPath = path.resolve(process.cwd(), "server", "templates", "sitemap.xml");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(sitemapPath);
  });

  app.get("/contact", (_req: Request, res: Response) => {
    const contactPath = path.resolve(process.cwd(), "server", "templates", "contact.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(contactPath);
  });

  // Privacy Policy — required for App Store / Play Store compliance.
  app.get("/privacy-policy", (_req: Request, res: Response) => {
    const policyPath = path.resolve(process.cwd(), "server", "templates", "privacy-policy.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(policyPath);
  });
  app.get("/privacypolicy", (_req: Request, res: Response) => {
    res.redirect(301, "/privacy-policy");
  });

  // Terms — required for App Store / Play Store compliance.
  app.get("/terms", (_req: Request, res: Response) => {
    const termsPath = path.resolve(process.cwd(), "server", "templates", "terms.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(termsPath);
  });
  for (const alias of [
    "/term",
    "/termsofservice",
    "/terms-of-service",
    "/termsandconditions",
    "/terms-and-conditions",
  ]) {
    app.get(alias, (_req: Request, res: Response) => {
      res.redirect(301, "/terms");
    });
  }

  // Landing page (Probaly marketing/web app).
  const templatePath = path.resolve(process.cwd(), "server", "templates", "landing-page.html");
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  app.get("/", (req: Request, res: Response) => {
    serveLandingPage({ req, res, landingPageTemplate, appName });
  });

  // Web fallback for password reset deep link. Email links use this URL so
  // users who don't have the mobile app installed can still finish the flow.
  // Mobile users tapping the link open the app via the deep-link scheme; web
  // users land on this static page which posts to /api/auth/reset-password.
  app.get("/auth/reset", (_req: Request, res: Response) => {
    const resetPath = path.resolve(process.cwd(), "server", "templates", "reset-password.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(resetPath);
  });

  // Static built assets (Expo static-build manifests etc.) without serving an index.
  app.use(express.static(path.resolve(process.cwd(), "static-build"), { index: false }));

  // SPA-style fallback to landing page for any other browser path. API and
  // runtime upload routes pass through to their own handlers.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads/")) {
      return next();
    }
    serveLandingPage({ req, res, landingPageTemplate, appName });
  });

  log("Configured Expo manifest middleware + landing page + legal pages");
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
  setupSecurityHeaders(app);
  setupCors(app);

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  setupRequestLogging(app);
  configureLegalPages(app);

  const server = await registerRoutes(app);

  // i18n translation cache: bootstraps the prediction_translations table
  // so the prediction read endpoints can serve localized copy without
  // re-translating on every request. Failure is non-fatal — endpoints
  // fall back to English text on a missing/broken cache.
  try {
    const { initTranslationCache } = await import("./services/translationService");
    await initTranslationCache();
  } catch (err) {
    log(`Translation cache init failed (continuing): ${(err as Error).message}`);
  }

  // Password-reset tokens table: bootstrapped via raw SQL so we don't touch
  // shared/schema.ts. Mirrors the translation_cache / telegram_media pattern.
  try {
    const { initPasswordResetTable, purgeExpiredResetTokens } = await import(
      "./services/passwordResetService"
    );
    await initPasswordResetTable();
    await purgeExpiredResetTokens();
  } catch (err) {
    log(`Password reset table init failed (continuing): ${(err as Error).message}`);
  }

  // Telegram channel mirror: ingests photos/videos from the configured
  // private channel and exposes them to the landing page for 24h.
  // Mounts /api/landing/telegram-media + /uploads/telegram static serve.
  try {
    const { initTelegramService, disconnectTelegramClient } = await import("./services/telegramService");
    await initTelegramService(app);
    // Graceful shutdown: release the Telegram auth key before this process
    // exits so the next deployment instance doesn't get AUTH_KEY_DUPLICATED.
    process.on("SIGTERM", () => {
      void disconnectTelegramClient().finally(() => process.exit(0));
    });
  } catch (err) {
    log(`Telegram service init failed (continuing): ${(err as Error).message}`);
  }

  setupErrorHandler(app);

  // Single-active-session support: ensure users.token_version exists BEFORE
  // accepting traffic. The login handler relies on this column existing to
  // bump the counter on every login; if a request hit before the column
  // existed, the bump would silently fail and revocation would not work.
  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0
    `);
    log("Ensured users.token_version column exists");
  } catch (err) {
    log(`FATAL: token_version migration failed: ${(err as Error).message}`);
    throw err;
  }

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

      // One-time cleanup: remove incorrectly resolved Atletico-Barcelona prediction
      try {
        const { predictions } = await import("../shared/schema");
        const deleted = await db.delete(predictions).where(eq(predictions.id, 4113)).returning();
        if (deleted.length > 0) log(`Removed prediction ID 4113 (${deleted[0].matchTitle}) from DB`);
      } catch {}

      // Idempotent cleanup: strip legacy "[DEMO] " prefix from prediction explanations.
      try {
        const { sql } = await import("drizzle-orm");
        const result: any = await db.execute(sql`
          UPDATE predictions
          SET explanation = SUBSTRING(explanation FROM 8)
          WHERE explanation LIKE '[DEMO] %'
        `);
        const updated = result?.rowCount ?? result?.count ?? 0;
        if (updated > 0) log(`Stripped [DEMO] prefix from ${updated} prediction(s)`);
      } catch (err) {
        log(`[DEMO] cleanup skipped: ${(err as Error).message}`);
      }

      // Initialize push notification tokens table
      const { initPushTokensTable } = await import("./services/pushNotificationService");
      await initPushTokensTable();

      // Start daily prediction refresh scheduler (runs on startup and every 24 hours)
      startDailyRefreshScheduler();
    },
  );
})();
