import OpenAI from "openai";
import { db } from "../db";
import { predictions, type InsertPrediction } from "@shared/schema";
import { eq, and, gte, isNull, desc, sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface SportsMatch {
  homeTeam: string;
  awayTeam: string;
  sport: string;
  matchTime: Date;
  league?: string;
}

interface PredictionAnalysis {
  predictedOutcome: string;
  probability: number;
  confidence: "high" | "medium" | "low";
  explanation: string;
  factors: Array<{
    title: string;
    description: string;
    impact: "positive" | "negative" | "neutral";
  }>;
  riskIndex: number;
}

// Sample upcoming matches - in production, fetch from sports API
// Generates 5+ matches per sport category
function getUpcomingMatches(): SportsMatch[] {
  const hours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
  
  return [
    // Football/Soccer (6 matches)
    { homeTeam: "Manchester United", awayTeam: "Liverpool", sport: "football", matchTime: hours(24), league: "Premier League" },
    { homeTeam: "Real Madrid", awayTeam: "Barcelona", sport: "football", matchTime: hours(48), league: "La Liga" },
    { homeTeam: "Bayern Munich", awayTeam: "Dortmund", sport: "football", matchTime: hours(36), league: "Bundesliga" },
    { homeTeam: "Arsenal", awayTeam: "Chelsea", sport: "football", matchTime: hours(60), league: "Premier League" },
    { homeTeam: "PSG", awayTeam: "Lyon", sport: "football", matchTime: hours(72), league: "Ligue 1" },
    { homeTeam: "Juventus", awayTeam: "AC Milan", sport: "football", matchTime: hours(84), league: "Serie A" },
    
    // Basketball (6 matches)
    { homeTeam: "Lakers", awayTeam: "Celtics", sport: "basketball", matchTime: hours(12), league: "NBA" },
    { homeTeam: "Warriors", awayTeam: "Bucks", sport: "basketball", matchTime: hours(18), league: "NBA" },
    { homeTeam: "Nuggets", awayTeam: "Heat", sport: "basketball", matchTime: hours(30), league: "NBA" },
    { homeTeam: "76ers", awayTeam: "Suns", sport: "basketball", matchTime: hours(42), league: "NBA" },
    { homeTeam: "Mavericks", awayTeam: "Clippers", sport: "basketball", matchTime: hours(54), league: "NBA" },
    { homeTeam: "Nets", awayTeam: "Knicks", sport: "basketball", matchTime: hours(66), league: "NBA" },
    
    // Tennis (5 matches)
    { homeTeam: "Djokovic", awayTeam: "Alcaraz", sport: "tennis", matchTime: hours(20), league: "ATP Tour" },
    { homeTeam: "Sinner", awayTeam: "Medvedev", sport: "tennis", matchTime: hours(32), league: "ATP Tour" },
    { homeTeam: "Zverev", awayTeam: "Ruud", sport: "tennis", matchTime: hours(44), league: "ATP Tour" },
    { homeTeam: "Swiatek", awayTeam: "Sabalenka", sport: "tennis", matchTime: hours(56), league: "WTA Tour" },
    { homeTeam: "Gauff", awayTeam: "Rybakina", sport: "tennis", matchTime: hours(68), league: "WTA Tour" },
    
    // Baseball (5 matches)
    { homeTeam: "Yankees", awayTeam: "Red Sox", sport: "baseball", matchTime: hours(22), league: "MLB" },
    { homeTeam: "Dodgers", awayTeam: "Giants", sport: "baseball", matchTime: hours(34), league: "MLB" },
    { homeTeam: "Cubs", awayTeam: "Cardinals", sport: "baseball", matchTime: hours(46), league: "MLB" },
    { homeTeam: "Astros", awayTeam: "Rangers", sport: "baseball", matchTime: hours(58), league: "MLB" },
    { homeTeam: "Braves", awayTeam: "Phillies", sport: "baseball", matchTime: hours(70), league: "MLB" },
    
    // Hockey (5 matches)
    { homeTeam: "Rangers", awayTeam: "Bruins", sport: "hockey", matchTime: hours(26), league: "NHL" },
    { homeTeam: "Maple Leafs", awayTeam: "Canadiens", sport: "hockey", matchTime: hours(38), league: "NHL" },
    { homeTeam: "Oilers", awayTeam: "Flames", sport: "hockey", matchTime: hours(50), league: "NHL" },
    { homeTeam: "Lightning", awayTeam: "Panthers", sport: "hockey", matchTime: hours(62), league: "NHL" },
    { homeTeam: "Penguins", awayTeam: "Capitals", sport: "hockey", matchTime: hours(74), league: "NHL" },
    
    // Cricket (5 matches)
    { homeTeam: "India", awayTeam: "Australia", sport: "cricket", matchTime: hours(28), league: "Test Series" },
    { homeTeam: "England", awayTeam: "New Zealand", sport: "cricket", matchTime: hours(40), league: "ODI Series" },
    { homeTeam: "Pakistan", awayTeam: "South Africa", sport: "cricket", matchTime: hours(52), league: "T20 Series" },
    { homeTeam: "West Indies", awayTeam: "Bangladesh", sport: "cricket", matchTime: hours(64), league: "ODI Series" },
    { homeTeam: "Sri Lanka", awayTeam: "Afghanistan", sport: "cricket", matchTime: hours(76), league: "T20 Series" },
    
    // MMA (5 matches)
    { homeTeam: "Jones", awayTeam: "Miocic", sport: "mma", matchTime: hours(96), league: "UFC" },
    { homeTeam: "Makhachev", awayTeam: "Oliveira", sport: "mma", matchTime: hours(108), league: "UFC" },
    { homeTeam: "Adesanya", awayTeam: "Pereira", sport: "mma", matchTime: hours(120), league: "UFC" },
    { homeTeam: "Edwards", awayTeam: "Covington", sport: "mma", matchTime: hours(132), league: "UFC" },
    { homeTeam: "O'Malley", awayTeam: "Dvalishvili", sport: "mma", matchTime: hours(144), league: "UFC" },
    
    // Golf (5 events)
    { homeTeam: "Scheffler", awayTeam: "McIlroy", sport: "golf", matchTime: hours(100), league: "PGA Tour" },
    { homeTeam: "Rahm", awayTeam: "Koepka", sport: "golf", matchTime: hours(112), league: "LIV Golf" },
    { homeTeam: "DeChambeau", awayTeam: "Hovland", sport: "golf", matchTime: hours(124), league: "PGA Tour" },
    { homeTeam: "Spieth", awayTeam: "Thomas", sport: "golf", matchTime: hours(136), league: "PGA Tour" },
    { homeTeam: "Morikawa", awayTeam: "Cantlay", sport: "golf", matchTime: hours(148), league: "PGA Tour" },
  ];
}

async function generatePredictionForMatch(match: SportsMatch): Promise<PredictionAnalysis> {
  const prompt = `You are a sports analytics AI. Analyze this upcoming ${match.sport} match and provide a prediction.

Match: ${match.homeTeam} vs ${match.awayTeam}
League: ${match.league || "Unknown"}
Sport: ${match.sport}

Provide your analysis in the following JSON format:
{
  "predictedOutcome": "A specific outcome like 'Home Win', 'Away Win', 'Draw', 'Over 2.5 Goals', etc.",
  "probability": <number between 50-95 representing win probability>,
  "confidence": "high" | "medium" | "low",
  "explanation": "A detailed 2-3 sentence explanation of why this prediction was made",
  "factors": [
    {"title": "Factor name", "description": "Brief description", "impact": "positive" | "negative" | "neutral"},
    {"title": "Factor name", "description": "Brief description", "impact": "positive" | "negative" | "neutral"},
    {"title": "Factor name", "description": "Brief description", "impact": "positive" | "negative" | "neutral"}
  ],
  "riskIndex": <number between 10-50 representing risk level, lower is safer>
}

Be realistic with probabilities. Respond with ONLY the JSON object, no additional text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || "{}";
  
  try {
    const parsed = JSON.parse(content);
    return {
      predictedOutcome: parsed.predictedOutcome || "No prediction available",
      probability: Math.min(95, Math.max(50, parsed.probability || 60)),
      confidence: parsed.confidence || "medium",
      explanation: parsed.explanation || "Analysis pending.",
      factors: parsed.factors || [],
      riskIndex: Math.min(50, Math.max(10, parsed.riskIndex || 30)),
    };
  } catch {
    return {
      predictedOutcome: "Home Win",
      probability: 65,
      confidence: "medium",
      explanation: "Based on current form and historical performance.",
      factors: [],
      riskIndex: 30,
    };
  }
}

// Get start of today in UTC
function getStartOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Check if a free prediction exists for today
async function hasTodaysFreePrediction(): Promise<boolean> {
  const startOfToday = getStartOfToday();
  const [existing] = await db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.isPremium, false),
        isNull(predictions.userId),
        gte(predictions.createdAt, startOfToday)
      )
    )
    .limit(1);
  
  return !!existing;
}

// Generate the daily free prediction (called on first request of day)
export async function generateDailyFreePrediction(): Promise<void> {
  const alreadyExists = await hasTodaysFreePrediction();
  if (alreadyExists) {
    console.log("Today's free prediction already exists, skipping generation");
    return;
  }

  console.log("Generating daily free prediction...");
  
  const matches = getUpcomingMatches();
  const match = matches[0]; // Pick first upcoming match for free prediction
  
  try {
    const analysis = await generatePredictionForMatch(match);
    
    const predictionData: InsertPrediction = {
      userId: null, // Free prediction is public
      matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
      sport: match.sport,
      matchTime: match.matchTime,
      predictedOutcome: analysis.predictedOutcome,
      probability: analysis.probability,
      confidence: analysis.confidence,
      explanation: analysis.explanation,
      factors: analysis.factors,
      riskIndex: analysis.riskIndex,
      isLive: false,
      isPremium: false,
      result: null,
      expiresAt: new Date(match.matchTime.getTime() + 3 * 60 * 60 * 1000),
    };

    await db.insert(predictions).values(predictionData);
    console.log(`Generated free prediction for: ${match.homeTeam} vs ${match.awayTeam}`);
  } catch (error) {
    console.error("Failed to generate daily free prediction:", error);
    throw error;
  }
}

// Generate premium predictions for a specific user (called when they subscribe)
export async function generatePremiumPredictionsForUser(userId: string): Promise<void> {
  console.log(`Generating premium predictions for user: ${userId}`);
  
  // Check if user already has premium predictions
  const existing = await db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.userId, userId),
        eq(predictions.isPremium, true)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    console.log("User already has premium predictions, skipping generation");
    return;
  }
  
  const matches = getUpcomingMatches();
  
  // Generate predictions for all matches (skip first one which is free)
  // This gives 5+ predictions per sport category
  for (let i = 1; i < matches.length; i++) {
    const match = matches[i];
    
    try {
      const analysis = await generatePredictionForMatch(match);
      
      const predictionData: InsertPrediction = {
        userId: userId, // Premium prediction is user-specific
        matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
        sport: match.sport,
        matchTime: match.matchTime,
        predictedOutcome: analysis.predictedOutcome,
        probability: analysis.probability,
        confidence: analysis.confidence,
        explanation: analysis.explanation,
        factors: analysis.factors,
        riskIndex: analysis.riskIndex,
        isLive: false,
        isPremium: true,
        result: null,
        expiresAt: new Date(match.matchTime.getTime() + 3 * 60 * 60 * 1000),
      };

      await db.insert(predictions).values(predictionData);
      console.log(`Generated premium prediction for user ${userId}: ${match.homeTeam} vs ${match.awayTeam}`);
    } catch (error) {
      console.error(`Failed to generate prediction for ${match.homeTeam} vs ${match.awayTeam}:`, error);
    }
  }
  
  console.log(`Premium predictions generation complete for user: ${userId}`);
}

// Legacy function for manual generation (admin use)
export async function generateDailyPredictions(): Promise<void> {
  await generateDailyFreePrediction();
}

export async function getFreeTip() {
  // First, ensure today's free prediction exists
  await generateDailyFreePrediction();
  
  const now = new Date();
  const [freeTip] = await db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.isPremium, false),
        isNull(predictions.userId),
        gte(predictions.matchTime, now),
        isNull(predictions.result)
      )
    )
    .orderBy(desc(predictions.createdAt))
    .limit(1);
  
  return freeTip || null;
}

export async function getPremiumPredictions(userId?: string) {
  if (!userId) {
    return [];
  }
  
  const now = new Date();
  return db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.isPremium, true),
        eq(predictions.userId, userId),
        eq(predictions.isLive, false),
        gte(predictions.matchTime, now),
        isNull(predictions.result)
      )
    )
    .orderBy(predictions.matchTime);
}

export async function getLivePredictions(userId?: string) {
  if (!userId) {
    // Return only non-premium live predictions for non-authenticated users
    return db.select()
      .from(predictions)
      .where(
        and(
          eq(predictions.isLive, true),
          eq(predictions.isPremium, false)
        )
      )
      .orderBy(predictions.matchTime);
  }
  
  // Return user's live predictions + public ones
  return db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.isLive, true),
        sql`(${predictions.userId} = ${userId} OR ${predictions.userId} IS NULL)`
      )
    )
    .orderBy(predictions.matchTime);
}

export async function getHistoryPredictions(userId?: string) {
  if (!userId) {
    // Return only public correct predictions
    return db.select()
      .from(predictions)
      .where(
        and(
          eq(predictions.result, "correct"),
          isNull(predictions.userId)
        )
      )
      .orderBy(desc(predictions.matchTime));
  }
  
  // Return user's correct predictions + public ones
  return db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.result, "correct"),
        sql`(${predictions.userId} = ${userId} OR ${predictions.userId} IS NULL)`
      )
    )
    .orderBy(desc(predictions.matchTime));
}

export async function getPredictionsBySport(sport: string, userId?: string) {
  const now = new Date();
  
  if (!userId) {
    // Return only free predictions for the sport
    return db.select()
      .from(predictions)
      .where(
        and(
          eq(predictions.sport, sport),
          eq(predictions.isPremium, false),
          isNull(predictions.userId),
          gte(predictions.matchTime, now),
          isNull(predictions.result),
          eq(predictions.isLive, false)
        )
      )
      .orderBy(predictions.matchTime);
  }
  
  // Return user's predictions + free predictions for the sport
  return db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.sport, sport),
        gte(predictions.matchTime, now),
        isNull(predictions.result),
        eq(predictions.isLive, false),
        sql`(${predictions.userId} = ${userId} OR ${predictions.userId} IS NULL)`
      )
    )
    .orderBy(predictions.matchTime);
}

export async function getPredictionById(id: number) {
  const [prediction] = await db.select()
    .from(predictions)
    .where(eq(predictions.id, id))
    .limit(1);
  
  return prediction || null;
}

export async function markPredictionResult(id: number, result: "correct" | "incorrect") {
  await db.update(predictions)
    .set({ result })
    .where(eq(predictions.id, id));
}

export async function getActivePredictions() {
  const now = new Date();
  return db.select()
    .from(predictions)
    .where(
      and(
        gte(predictions.matchTime, now),
        isNull(predictions.result)
      )
    )
    .orderBy(predictions.matchTime);
}

// Get prediction counts for each sport
export async function getSportPredictionCounts(userId?: string) {
  const now = new Date();
  const sports = ["football", "basketball", "tennis", "baseball", "hockey", "cricket", "mma", "golf"];
  const counts: Record<string, number> = {};
  
  for (const sport of sports) {
    const sportPredictions = await getPredictionsBySport(sport, userId);
    counts[sport] = sportPredictions.length;
  }
  
  return counts;
}
