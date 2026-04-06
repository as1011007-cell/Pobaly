# Probaly - AI Sports Prediction App

## Overview
Probaly is a mobile sports prediction application available on iOS and Android, developed using React Native and Expo. It leverages AI to provide probability-based insights for sports events. The app operates on a freemium model, offering a daily free tip and a premium subscription priced at $49/year. The business vision is to become a leading platform for AI-driven sports analytics, offering users a competitive edge in sports predictions.

## User Preferences
The agent should prioritize security best practices in all development tasks. When implementing new features, consider the impact on app store compliance and user privacy. The agent should also ensure that the application's performance remains optimal, especially concerning API response times and prediction generation. Do not make changes to the folder `shared`.

## System Architecture

### UI/UX Decisions
The application features a 5-tab navigation system (Home, Live, Sports, History, Profile). The brand utilizes a color scheme of Navy Blue (`#1A237E`) as primary and Bold Red (`#E53935`) as accent. Success indicators are Emerald (`#10B981`) and warnings are Amber (`#F59E0B`).

### Technical Implementations
- **Frontend**: React Native with Expo for cross-platform mobile development.
- **Backend**: Express.js in TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Email/password with bcrypt for hashing and JWT for session management (30-day expiry).
- **AI Integration**: OpenAI GPT-4o powers the sports predictions, integrated via Replit AI Integrations.
- **Payment Processing**: RevenueCat handles in-app purchases for iOS and Android. Stripe is used exclusively for affiliate payouts.
- **Data Refresh**: A daily scheduler refreshes predictions, clears expired entries, fetches new games, and regenerates AI predictions.
- **Premium History Filtering**: Premium members only see winning predictions from their subscription start date onwards, while non-premium members see all predictions.
- **Affiliate Program**: Includes referral code generation, commission tracking (40% of subscription revenue), a 14-day clearance period, and manual payout approval via Stripe Connect.
- **Security**: Implements real JWT authentication, role-based access control (`requireAuth`, `requireAdmin`), per-route rate limiting, security headers, and tightened CORS policies.
- **App Store Compliance**: Includes iOS Privacy Manifest, deep linking (`probaly://`), a gambling disclaimer, and legal page accessibility.

### Feature Specifications
- **AI-Powered Predictions**: Each prediction includes probability, confidence, explanation, factors, and a risk index.
- **Live Match Updates**: Provides real-time updates for ongoing games.
- **Prediction History**: Users can track their past predictions.
- **Subscription Model**: Offers a "Probaly Premium" subscription with monthly and annual options.
- **Sports Data Fallback**: Automatically switches to ESPN's free public API if The Odds API quota is exhausted, ensuring continuous data availability.
- **Sportsbook Consensus Odds**: Displays odds from major sportsbooks (DraftKings, FanDuel, BetMGM, Caesars, PointsBet) in American format with implied probability and consensus percentages.

## External Dependencies
- **OpenAI**: Used for AI-powered sports predictions (GPT-4o).
- **RevenueCat**: Manages in-app subscriptions and purchases on iOS and Android.
- **Stripe**: Handles affiliate program payouts via Stripe Connect.
- **The Odds API**: Primary source for real-time sports event data.
- **ESPN API**: Secondary data source for sports events, used as a fallback.