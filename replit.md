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
- **Authentication**: Email/password with bcrypt and JWT, including email validation and password reset functionality.
- **AI Integration**: Groq (llama-3.3-70b-versatile) for all prediction generation and batch resolution.
- **Payment Processing**: RevenueCat for in-app purchases on iOS and Android.
- **Data Refresh**: Daily scheduler for predictions, fetching new games, and regenerating AI predictions, followed by push notifications. Includes robust free-tip swap logic to ensure continuous availability.
- **System-Pick Generation Locking**: A shared async mutex (`systemPickLock`) serializes all system-pick generation to prevent race conditions and duplicate predictions.
- **Push Notifications**: Utilizes Expo Push Notifications with localization support for 7 languages.
- **History Filtering**: Premium users see correct pre-game predictions for 30 days. Free users see correct free daily tips for 30 days and ESPN history for 5 days. Incorrect predictions are never shown.
- **Security**: Implements JWT authentication, role-based access control, rate limiting, security headers, tightened CORS, and webhook signature verification.
- **Performance / Scalability**: Uses `compression` middleware, increased DB connection pool, and `Cache-Control` headers for API responses. Client-side caching is implemented with React Query.
- **Deployment**: Production server uses port 8081; development server uses port 5000.
- **OTA Updates (EAS Update)**: Enabled for JS-only changes via `expo-updates`. Native changes require a full EAS Build and App Store submission.
- **Post-Purchase Premium Cache**: An in-memory cache significantly reduces latency for premium entitlement activation.
- **App Store Compliance**: Includes iOS Privacy Manifest, deep linking, gambling disclaimer, and legal page accessibility.
- **Vector Icon Font Embedding**: `Feather` icons are natively embedded for EAS builds and preloaded via JS for all platforms to prevent flicker.
- **Localization (i18n)**: Supports 7 languages. Static UI strings are handled client-side, while AI-generated prediction copy is translated server-side by Groq and cached.
- **Social Auto-Posting**: Automatically posts winning free tips to Instagram and Facebook via Publer, including branded image generation.

### Feature Specifications
- **AI-Powered Predictions**: Provides probability, confidence, explanation, factors, and risk index; includes over/under for basketball.
- **Live Match Updates**: Real-time updates for ongoing games.
- **Prediction History**: Allows users to track past predictions.
- **Subscription Model**: "Probaly Premium" with monthly and annual options via in-app purchases. The server also hosts marketing and legal pages.
- **Sports Data Fallback**: Automatically switches to ESPN's public API if The Odds API quota is exhausted.
- **Telegram Channel Mirror**: Displays media from a private Telegram channel on the landing page.

## External Dependencies
- **Groq**: For AI-powered sports predictions.
- **RevenueCat**: For in-app subscriptions and purchases.
- **The Odds API**: Primary source for sports event data.
- **ESPN API**: Secondary data source for sports events.
- **Publer**: For scheduling social media posts.
- **sharp**: For server-side image compositing.