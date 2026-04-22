# Probaly - AI Sports Prediction App

## Overview
Probaly is a mobile sports prediction application available on iOS and Android, developed using React Native and Expo. It leverages AI to provide probability-based insights for sports events. The app operates on a freemium model, offering a daily free tip and a premium subscription priced at $49/year. The business vision is to become a leading platform for AI-driven sports analytics, offering users a competitive edge in sports predictions.

## User Preferences
- **Production-First**: All development work should target the production server (probaly.net). The development server (localhost:5000) is only used for testing code before deploying. Every code change must be deployed to production to take effect. No dev-only workarounds.
- The agent should prioritize security best practices in all development tasks. When implementing new features, consider the impact on app store compliance and user privacy. The agent should also ensure that the application's performance remains optimal, especially concerning API response times and prediction generation. Do not make changes to the folder `shared`.

## System Architecture

### UI/UX Decisions
The application features a 5-tab navigation system (Home, Live, Sports, History, Profile). The brand utilizes a color scheme of Navy Blue (`#1A237E`) as primary and Bold Red (`#E53935`) as accent. Success indicators are Emerald (`#10B981`) and warnings are Amber (`#F59E0B`).

### Technical Implementations
- **Frontend**: React Native with Expo for cross-platform mobile development.
- **Backend**: Express.js in TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Email/password with bcrypt for hashing and JWT for session management (30-day expiry).
- **AI Integration**: OpenAI GPT-4o powers the sports predictions via direct OpenAI API (OPENAI_API_KEY).
- **Payment Processing**: RevenueCat handles in-app purchases for iOS and Android. Stripe is used exclusively for affiliate payouts.
- **Data Refresh**: A daily scheduler refreshes predictions, clears expired entries, fetches new games, and regenerates AI predictions. After refresh, push notifications are sent to all registered devices to alert users that the daily free tip is ready.
- **Push Notifications**: Uses Expo Push Notifications API. Client registers push tokens on login/signup/app restart. Server stores tokens in `push_tokens` table and sends via Expo's push API. Respects user notification preferences.
- **History Filtering Rules (NEVER change without explicit instruction)**:
  - **Premium users**: See only `correct` predictions — both premium picks and free daily tips — that were real pre-game predictions (`expiresAt > matchTime`), within last 30 days. Retroactive ESPN entries (`expiresAt = matchTime`) never shown. Incorrect predictions are never shown.
  - **Free users**: Correct picks only, split into two windows: real free daily tips (`isPremium = false`, `expiresAt > matchTime`) shown for 30 days; retroactive ESPN history entries (`expiresAt = matchTime`) shown for 5 days. Incorrect predictions are NEVER shown.
- **Affiliate Program**: Currently disabled. Code retained in `server/affiliateRoutes.ts` and `client/screens/AffiliateScreen.tsx` for future re-enablement. Was: referral code generation, commission tracking (40%), 14-day clearance, manual payout approval via Stripe Connect.
- **Security**: Implements real JWT authentication, role-based access control (`requireAuth`, `requireAdmin`), per-route rate limiting, security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), tightened CORS policies, RevenueCat webhook authorization (via `REVENUECAT_WEBHOOK_SECRET`), and Stripe webhook signature verification.
- **Deployment**: Production server binds to port 8081 (set via deployment run command `PORT=8081 npm run server:prod`) to match Replit's port mapping (external 80 → local 8081). Dev server uses port 5000.
- **App Store Compliance**: Includes iOS Privacy Manifest, deep linking (`probaly://`), a gambling disclaimer, and legal page accessibility.

### Feature Specifications
- **AI-Powered Predictions**: Each prediction includes probability, confidence, explanation, factors, and a risk index. Basketball games include over/under total points predictions alongside winner predictions.
- **Over/Under Bets (Basketball)**: AI generates game total (over/under) predictions for basketball matches with realistic point lines. Match titles use `(O/U)` suffix. Result resolution compares total score against the line. History entries include O/U records for completed basketball games.
- **Live Match Updates**: Provides real-time updates for ongoing games.
- **Prediction History**: Users can track their past predictions.
- **Subscription Model**: Offers a "Probaly Premium" subscription with monthly ($49.99) and annual ($149.00) options. iOS/Android uses RevenueCat for in-app purchases. Web browser users use Stripe Checkout (redirects to Stripe-hosted payment page, webhook activates premium).
- **Sports Data Fallback**: Automatically switches to ESPN's free public API if The Odds API quota is exhausted, ensuring continuous data availability.

## External Dependencies
- **OpenAI**: Used for AI-powered sports predictions (GPT-4o).
- **RevenueCat**: Manages in-app subscriptions and purchases on iOS and Android.
- **Stripe**: Handles web browser premium subscriptions via Stripe Checkout. Price IDs are configured via `EXPO_PUBLIC_STRIPE_PRICE_MONTHLY` and `EXPO_PUBLIC_STRIPE_PRICE_ANNUAL` environment variables (shared). The server exposes `/api/billing/config` as the canonical source; the client fetches from there with env var fallback. Affiliate payout via Stripe Connect is currently disabled.
- **The Odds API**: Primary source for real-time sports event data.
- **ESPN API**: Secondary data source for sports events, used as a fallback.