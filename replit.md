# Probaly - AI Sports Prediction App

## Overview
Probaly is a mobile sports prediction app (iOS/Android) built with React Native and Expo. It provides AI-powered probability insights for sports events with a free daily tip and $49/year premium subscription.

## Tech Stack
- **Frontend**: React Native with Expo
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Payments**: Stripe integration via stripe-replit-sync
- **Authentication**: Email/password with bcrypt
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
- Premium subscription ($49/year) via Stripe
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
  - Monthly: $49/month (original $99/month - 50% off) - price_1StZauCow6jut3nLmIWUckQ7
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

## Running the App
- Backend: `npm run server:dev` (port 5000)
- Frontend: `npm run expo:dev` (port 8081)

## App Store Compliance
- Bundle ID: com.probaly.app (iOS and Android)
- Privacy Policy: Accessible from Profile and Subscription screens (privacy@probaly.app)
- Terms of Service: Accessible from Profile and Subscription screens (support@probaly.app)
- Gambling Disclaimer: Home screen footer with 18+ requirement and "entertainment purposes only"
- Restore Purchase: Functional button in Subscription screen footer
- Age Rating: 17+ (Frequent/Intense Simulated Gambling)

## Recent Changes
- January 2026: Added App Store compliance (gambling disclaimer, restore purchases, legal pages)
- January 2026: Added user-specific predictions (userId field for personalized premium predictions)
- January 2026: Rebranded back to Probaly with new logo (keeping navy/red colors)
- January 2026: Added AI-powered predictions using OpenAI GPT-4o
- January 2026: Added Stripe payment integration
