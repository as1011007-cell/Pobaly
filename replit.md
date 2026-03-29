# Probaly - AI Sports Prediction App

## Overview
Probaly is a mobile sports prediction app (iOS/Android) built with React Native and Expo. It provides AI-powered probability insights for sports events with a free daily tip and $49/year premium subscription.

## Tech Stack
- **Frontend**: React Native with Expo
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Payments**: RevenueCat for in-app purchases (Apple App Store / Google Play Store). Stripe retained for affiliate Stripe Connect payouts only.
- **Authentication**: Email/password with bcrypt + JWT (real signed tokens, 30d expiry)
- **AI**: OpenAI GPT-4o via Replit AI Integrations

## Project Structure
```
client/           # React Native Expo app
  components/     # Reusable UI components
  screens/        # App screens
  contexts/       # React contexts (Auth)
  navigation/     # React Navigation setup
  constants/      # Theme, colors
  hooks/          # Custom hooks
  lib/            # API client, storage utilities
  types/          # TypeScript types

server/           # Express backend
  index.ts        # Server entry point with Stripe webhook
  routes.ts       # API routes (auth, checkout, products, predictions)
  storage.ts      # Database operations
  stripeClient.ts # Stripe client initialization
  stripeService.ts # Stripe API operations
  webhookHandlers.ts # Stripe webhook processing
  db.ts           # Drizzle database connection
  services/       # Business logic services
    predictionService.ts # AI prediction generation

shared/           # Shared types and schemas
  schema.ts       # Drizzle database schema
```

## Key Features
- 5-tab navigation: Home, Live, Sports, History, Profile
- Email authentication
- Premium subscription via RevenueCat (Apple/Google native in-app purchases, $49.99/month or $149/year)
- AI-powered sports predictions with confidence levels (OpenAI GPT-4o)
- Live match updates
- Prediction history tracking

## Brand Colors (Probaly)
- Primary: Navy Blue #1A237E (from logo horns)
- Accent: Bold Red #E53935 (from logo bull/shield)
- Success: Emerald #10B981
- Warning: Amber #F59E0B

## Stripe Integration
The app uses Stripe for premium subscriptions:
- **Mode**: Live (uses STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment secrets)
- Product: "Probaly Premium" (prod_Tr6EClKeYSwbhx)
  - Monthly: $49.99/month (original $99/month - 50% off) - price_1StZauCow6jut3nLmIWUckQ7
  - Annual: $149/year (original $399/year - 63% off) - price_1StZavCow6jut3nLwXuIAtSx
- Webhook: `/api/stripe/webhook` (handled BEFORE express.json middleware)
- Checkout: `/api/checkout` creates Stripe Checkout sessions
- Note: If STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY secrets are set, they override the Replit connector (sandbox)

## AI Predictions
- Uses OpenAI GPT-4o via Replit AI Integrations
- Predictions generated on-demand via `/api/predictions/generate` endpoint
- Each prediction includes: probability, confidence, explanation, factors, risk index
- Billing: OpenAI public API rates deducted from Replit credits

## Sports Data Integration
- **API**: The Odds API (https://the-odds-api.com) for real upcoming games
- **Secret**: ODDS_API_KEY (required for live data, falls back to demo data without it)
- **Coverage**: NFL, NBA, Premier League, La Liga, Bundesliga, Serie A, Ligue 1, MLB, NHL, UFC, ATP Tennis
- **Daily Refresh**: Predictions automatically refresh every 24 hours
  - Clears expired predictions (past matches)
  - Fetches fresh upcoming games from sports API
  - Regenerates AI predictions for new matches
- **Scheduler**: `startDailyRefreshScheduler()` runs on server startup and every 24 hours

## API Endpoints
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - User login
- `GET /api/products-with-prices` - List products and prices
- `POST /api/checkout` - Create Stripe checkout session
- `GET /api/subscription/:userId` - Get user subscription status
- `POST /api/customer-portal` - Create Stripe customer portal session
- `GET /api/predictions/free-tip` - Get free daily prediction
- `GET /api/predictions/premium` - Get premium predictions
- `GET /api/predictions/live` - Get live match predictions
- `GET /api/predictions/history` - Get prediction history
- `GET /api/predictions/sport/:sport` - Get predictions by sport
- `GET /api/predictions/:id` - Get prediction by ID
- `POST /api/predictions/generate` - Generate new AI predictions

## Database Schema
Users table with Stripe fields:
- id, email, password, name
- stripeCustomerId, stripeSubscriptionId
- isPremium, subscriptionExpiry, createdAt

Predictions table:
- id, matchTitle, sport, matchTime
- predictedOutcome, probability, confidence
- explanation, factors, sportsbookOdds (JSONB)
- riskIndex, isLive, isPremium, result, userId
- createdAt, expiresAt

## Prediction System
- **Free Daily Tip**: One free prediction with >70% probability, includes sportsbook consensus odds from 5 books
- **Premium Predictions**: High-probability (>65%) predictions with sportsbook odds, streamlined view without extra stats
- Webhook handler triggers prediction generation on subscription activation
- All prediction endpoints support userId filtering for personalized results

## Sportsbook Consensus Odds
- Displays odds from 5 major sportsbooks: DraftKings, FanDuel, BetMGM, Caesars, PointsBet
- Shows American odds format (e.g., -300) and implied probability percentage
- Consensus percentage shows agreement across all books (e.g., "75%+ agree")
- Premium users see clean sportsbook odds view without extra statistics

## Affiliate Program
- **Commission**: 40% of subscription revenue
- **Referral Codes**: Format PRO + 5 random alphanumeric characters (e.g., PROX9K2A)
- **Clearance Period**: 14 business days (excludes weekends) before commissions become available
- **Minimum Payout**: $10
- **Payout Method**: Stripe Connect (affiliates connect their bank accounts)
- **Manual Approval**: Payout requests require admin approval before Stripe processes the transfer

### Affiliate API Endpoints
- `POST /api/affiliate/register` - Register as affiliate
- `GET /api/affiliate/dashboard/:userId` - Get affiliate stats and referrals
- `POST /api/affiliate/connect-stripe` - Start Stripe Connect onboarding
- `POST /api/affiliate/request-payout` - Submit payout request for approval
- `GET /api/affiliate/payout-requests/:userId` - Get user's payout requests
- `GET /api/affiliate/validate/:code` - Validate affiliate code

### Admin Payout Endpoints
- `GET /api/affiliate/admin/payout-requests?status=pending` - List payout requests by status
- `POST /api/affiliate/admin/approve-payout/:requestId` - Approve and process payout
- `POST /api/affiliate/admin/reject-payout/:requestId` - Reject payout request

### Database Tables
- `affiliates`: Stores affiliate info, referral codes, Stripe Connect accounts, earnings
- `referrals`: Tracks individual referrals with commission amounts and status
- `payout_requests`: Tracks payout requests with approval workflow status

## Running the App
- Backend: `npm run server:dev` (port 5000)
- Frontend: `npm run expo:dev` (port 8081)

## App Store Compliance
- Bundle ID: app.probaly.logic (iOS and Android)
- Privacy Policy: Accessible from Profile and Subscription screens (privacy@probaly.app)
- Terms of Service: Accessible from Profile and Subscription screens (support@probaly.app)
- Gambling Disclaimer: Home screen footer with 18+ requirement and "entertainment purposes only"
- Restore Purchase: Functional button in Subscription screen footer
- Age Rating: 17+ (Frequent/Intense Simulated Gambling)

## EAS Build Configuration (eas.json)
- **development**: Internal distribution, developmentClient=true, API → probaly.net
- **preview**: Internal TestFlight/APK distribution, Release mode, API → probaly.net
- **production**: App Store / Play Store, autoIncrement build numbers, API → probaly.net
- Fill in `appleId`, `ascAppId`, `appleTeamId` in submit config before using `eas submit`
- **IMPORTANT**: All `EXPO_PUBLIC_*` env vars (RevenueCat keys, domain) MUST be in each profile's `env` block in eas.json. EAS builds run on Expo cloud servers and have NO access to Replit environment secrets.
- RevenueCat keys are embedded in eas.json (safe — they are `EXPO_PUBLIC_` keys meant to ship in the app bundle)

## API URL Fallback
- `client/lib/query-client.ts` → `getApiUrl()` falls back to `https://probaly.net` when `EXPO_PUBLIC_DOMAIN` is not set
- This ensures TestFlight/App Store builds always connect to production server

## Deep Linking
- Scheme: `probaly://` and `https://probaly.net`
- `probaly://affiliate` → Affiliate screen
- `probaly://upgrade` → Subscription screen
- Configured in `client/App.tsx` via `NavigationContainer linking` prop

## iOS Privacy Manifest
- Declared in `app.json` under `ios.privacyManifests`
- `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` (for AsyncStorage)
- `NSPrivacyTracking: false` (app does not track users)

## App Icon
- `assets/images/app-icon-1024.png` — 1024x1024 AI-generated icon (bull head on navy background)
- Used as iOS icon, Android icon, splash screen, and favicon

## RevenueCat Subscription Sync Flow
When a user purchases on iOS/Android:
1. `AuthContext` calls `Purchases.logIn(userId)` on sign-in so purchases are linked to the DB user
2. After purchase, `SubscriptionScreen` calls `POST /api/revenuecat/sync` → sets `isPremium=true` in DB immediately
3. `GET /api/subscription/:userId` returns `isPremium` from DB (works for both Stripe and RevenueCat)
4. For ongoing renewals/cancellations: configure RevenueCat webhook in RevenueCat dashboard → `https://probaly.net/api/revenuecat/webhook`

### RevenueCat Webhook Setup (one-time, in RevenueCat dashboard)
- Go to RevenueCat Dashboard → Project Settings → Integrations → Webhooks
- Add endpoint URL: `https://probaly.net/api/revenuecat/webhook`
- Events handled: INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, UNCANCELLATION, TRANSFER, CANCELLATION, EXPIRATION, BILLING_ISSUE

## Recent Changes
- March 2026: Comprehensive purchase flow hardening
  - RevenueCat keys added to eas.json for all build profiles (root cause of TestFlight price loading failure — EAS cloud has no Replit secrets)
  - `initializeRevenueCat()` now guarded against multiple calls (_initialized flag)
  - `loginRevenueCat(userId)` now called on every app restart (loadUser) — previously RevenueCat was anonymous after relaunch
  - AuthContext uses exported loginRevenueCat/logoutRevenueCat helpers (no direct Purchases import)
  - `refreshUser()` always updates local state (was silently skipping when isPremium unchanged)
  - Restore purchases: correctly shows "No purchases found" if nothing was restored
  - Offerings and customer info: 20s timeout, 3 retries with exponential backoff
  - RevenueCat log level: DEBUG in dev, INFO in production
  - Subscription screen shows Retry button on connection failure; Expo Go shows clear TestFlight explanation
- March 2026: Fixed RevenueCat → server premium sync for native iOS/Android builds
  - POST /api/revenuecat/sync endpoint: immediately marks user isPremium after purchase
  - POST /api/revenuecat/webhook endpoint: handles subscription lifecycle events
  - GET /api/subscription/:userId now returns DB isPremium even without Stripe subscription
- March 2026: Complete App Store / Google Play production readiness pass
  - iOS Privacy Manifest added
  - Proper permissions declared and blocked on Android
  - EAS Build configuration (eas.json) with dev/preview/production profiles
  - Deep link handling (probaly://) added to NavigationContainer
  - getApiUrl() and RevenueCat init made crash-safe for native builds without env vars
  - New 1024x1024 app store icon generated
  - Android target/compile SDK 35, minSDK 24
- March 2026: Security hardening completed
  - Real JWT authentication (was fake `token-{userId}` strings) with `server/auth.ts`
  - `requireAuth` middleware on all user-specific endpoints (preferences, restore-purchases, affiliate, generate-premium)
  - `optionalAuth` middleware on prediction listing endpoints (premium status checked from DB, not client params)
  - `requireAdmin` middleware on admin endpoints (generate, generate-demo, mark result, payout management)
  - Admin key accepted only via `x-admin-key` header with constant-time comparison (no query string)
  - Per-route rate limiting (auth: 10/15min, contact: 5/hr, generate: 3/min) with scoped keys
  - Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS (prod only)
  - CORS tightened: localhost origins blocked in production, Authorization header allowed
  - Client sends JWT via `Authorization: Bearer` header on all API requests
  - JWT_SECRET fails-closed in production (must be set as env var)
- January 2026: Added affiliate program with 40% commission, 14 business day clearance, manual payout approval
- January 2026: Added App Store compliance (gambling disclaimer, restore purchases, legal pages)
- January 2026: Added user-specific predictions (userId field for personalized premium predictions)
- January 2026: Rebranded back to Probaly with new logo (keeping navy/red colors)
- January 2026: Added AI-powered predictions using OpenAI GPT-4o
- January 2026: Added Stripe payment integration
