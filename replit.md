# Probaly - AI Sports Prediction App

## Overview
Probaly is an AI-powered mobile sports prediction application for iOS and Android, built with React Native and Expo. It provides probability-based insights for sports events, operating on a freemium model with daily free tips and a premium subscription. The project aims to be a leading platform in AI-driven sports analytics, offering users a competitive edge in sports predictions.

## User Preferences
- **Production-First**: All development work should target the production server (probaly.net). The development server (localhost:5000) is only used for testing code before deploying. Every code change must be deployed to production to take effect. No dev-only workarounds.
- The agent should prioritize security best practices in all development tasks. When implementing new features, consider the impact on app store compliance and user privacy. The agent should also ensure that the application's performance remains optimal, especially concerning API response times and prediction generation. Do not make changes to the folder `shared`.

## System Architecture

### UI/UX Decisions
The application uses a 5-tab navigation system (Home, Live, Sports, History, Profile). The brand color scheme includes Navy Blue (`#1A237E`) as primary and Bold Red (`#E53935`) as accent. Success indicators are Emerald (`#10B981`) and warnings are Amber (`#F59E0B`).

### Technical Implementations
- **Frontend**: React Native with Expo.
- **Backend**: Express.js in TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Email/password with bcrypt and JWT. Email validation includes DNS MX record checks and a disposable domain blocklist.
- **AI Integration**: Groq (llama-3.3-70b-versatile) for all prediction generation and batch resolution.
- **Payment Processing**: RevenueCat for in-app purchases on iOS and Android (mobile-only — no web checkout flow).
- **Data Refresh**: Daily scheduler for predictions, clearing expired entries, fetching new games, and regenerating AI predictions, followed by push notifications.
- **System-Pick Generation Locking**: A shared async mutex (`systemPickLock`) serializes all system-pick generation to prevent race conditions and duplicate predictions.
- **Push Notifications**: Utilizes Expo Push Notifications, storing tokens in the database and respecting user preferences.
- **History Filtering**: Premium users see only correct pre-game predictions within the last 30 days. Free users see correct free daily tips for 30 days and retroactive ESPN history for 5 days. Incorrect predictions are never shown.
- **Security**: Implements JWT authentication, role-based access control, rate limiting, security headers, tightened CORS, and webhook signature verification.
- **Deployment**: Production server binds to port 8081; development server uses port 5000.
- **App Store Compliance**: Includes iOS Privacy Manifest, deep linking, gambling disclaimer, and legal page accessibility.

### Feature Specifications
- **AI-Powered Predictions**: Includes probability, confidence, explanation, factors, and risk index. Basketball predictions also include over/under total points.
- **Live Match Updates**: Real-time updates for ongoing games.
- **Prediction History**: Users can track past predictions.
- **Subscription Model**: "Probaly Premium" with monthly and annual options via RevenueCat in-app purchases (mobile only — no web checkout flow). The Express server ships the marketing landing page (`server/templates/landing-page.html`) at `/`, serves legal pages (`/privacy-policy`, `/terms`) and SEO assets (`/robots.txt`, `/sitemap.xml`, Google/Yandex verification files) for App Store / Play Store compliance, and a `/contact` page. Stripe payment integration was removed (no `/api/stripe/*` routes, no checkout pages); the leftover `stripe`/`stripe-replit-sync` deps in `package.json` are inert and not imported by the active server.
- **Sports Data Fallback**: Automatically switches to ESPN's public API if The Odds API quota is exhausted.
- **Telegram Channel Mirror (Landing Page)**: Connects to a private Telegram channel via gramjs MTProto to display media on the landing page. Features include random polling delays, exponential reconnect backoff, message exclusion, hard suspension capability, and a static fallback gallery.
- **Localization (i18n)**: The app supports 7 languages — English, Spanish, French, German, Japanese, Chinese (Simplified), and Russian. Static UI strings live in `client/lib/translations.ts` and are accessed via `useLanguage()`. AI-generated prediction copy (predictedOutcome, explanation, factor titles/descriptions) is translated server-side on demand by Groq (llama-3.3-70b-versatile, temperature 0.2, JSON mode). Translations are cached in the `prediction_translations` table (PK `prediction_id` + `language`) so each (pick, language) pair is generated once. Prediction read endpoints (`/free-tip`, `/premium`, `/live`, `/history`, `/sport/:sport`, `/:id`) accept `?lang=xx` and translate before redaction so the cache is shared across users. The Groq prompt is instructed to keep proper nouns (team/player/league names), all numbers, and the Over/Under market labels untouched. Failures (Groq down, parse error) fall back to English copy — better stale than blank. The cache table is bootstrapped via raw SQL in `server/services/translationService.ts:initTranslationCache()` (called from `server/index.ts` at boot), matching the `telegram_media` pattern; nothing is added to `shared/schema.ts`.

## External Dependencies
- **Groq**: Used for AI-powered sports predictions.
- **RevenueCat**: Manages in-app subscriptions and purchases on iOS and Android.
- **The Odds API**: Primary source for real-time sports event data.
- **ESPN API**: Secondary data source for sports events.