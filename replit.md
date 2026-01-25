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
- Product: "Probaly Premium" - $49/year
- Webhook: `/api/stripe/webhook` (handled BEFORE express.json middleware)
- Checkout: `/api/checkout` creates Stripe Checkout sessions

## AI Predictions
- Uses OpenAI GPT-4o via Replit AI Integrations
- Predictions generated on-demand via `/api/predictions/generate` endpoint
- Each prediction includes: probability, confidence, explanation, factors, risk index
- Billing: OpenAI public API rates deducted from Replit credits

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

## Recent Changes
- January 2026: Added user-specific predictions (userId field for personalized premium predictions)
- January 2026: Rebranded back to Probaly with new logo (keeping navy/red colors)
- January 2026: Added AI-powered predictions using OpenAI GPT-4o
- January 2026: Added Stripe payment integration
