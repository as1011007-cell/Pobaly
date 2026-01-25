# Probaly - AI Sports Prediction App

## Overview
Probaly is a mobile sports prediction app (iOS/Android) built with React Native and Expo. It provides AI-powered probability insights for sports events with a free daily tip and $49/year premium subscription.

## Tech Stack
- **Frontend**: React Native with Expo
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Payments**: Stripe integration via stripe-replit-sync
- **Authentication**: Email/password with bcrypt

## Project Structure
```
client/           # React Native Expo app
  components/     # Reusable UI components
  screens/        # App screens
  contexts/       # React contexts (Auth)
  navigation/     # React Navigation setup
  constants/      # Theme, colors, mock data
  hooks/          # Custom hooks
  lib/            # API client, storage utilities
  types/          # TypeScript types

server/           # Express backend
  index.ts        # Server entry point with Stripe webhook
  routes.ts       # API routes (auth, checkout, products)
  storage.ts      # Database operations
  stripeClient.ts # Stripe client initialization
  stripeService.ts # Stripe API operations
  webhookHandlers.ts # Stripe webhook processing
  db.ts           # Drizzle database connection
  seed-products.ts # Script to create Stripe products

shared/           # Shared types and schemas
  schema.ts       # Drizzle database schema
```

## Key Features
- 5-tab navigation: Home, Live, Sports, History, Profile
- Email authentication
- Premium subscription ($49/year) via Stripe
- AI-powered sports predictions with confidence levels
- Live match updates (mock data)
- Prediction history tracking

## Stripe Integration
The app uses Stripe for premium subscriptions:
- Product: "Probaly Premium" - $49/year
- Price ID: `price_1StO2PA1SeF8Id5gjmGMIlh9`
- Webhook: `/api/stripe/webhook` (handled BEFORE express.json middleware)
- Checkout: `/api/checkout` creates Stripe Checkout sessions

## API Endpoints
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - User login
- `GET /api/products-with-prices` - List products and prices
- `POST /api/checkout` - Create Stripe checkout session
- `GET /api/subscription/:userId` - Get user subscription status
- `POST /api/customer-portal` - Create Stripe customer portal session

## Database Schema
Users table with Stripe fields:
- id, email, password, name
- stripeCustomerId, stripeSubscriptionId
- isPremium, subscriptionExpiry, createdAt

## Running the App
- Backend: `npm run server:dev` (port 5000)
- Frontend: `npm run expo:dev` (port 8081)

## Design System
Brand colors (in client/constants/theme.ts):
- Primary: Deep Blue #1E3A8A
- Secondary: Emerald #10B981
- Accent: Amber #F59E0B
- Neutral: Slate tones

## Recent Changes
- January 2026: Added Stripe payment integration
- Created database schema with user authentication
- Implemented subscription checkout flow
