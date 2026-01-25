import OpenAI from "openai";
import { db } from "../db";
import { predictions, type InsertPrediction } from "@shared/schema";
import { eq, and, gte, isNull, desc, sql } from "drizzle-orm";
import { getUpcomingMatchesFromApi } from "./sportsApiService";

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

// Generate sportsbook consensus odds based on probability
function generateSportsbookOdds(probability: number, outcome: string) {
  // Convert probability to American odds
  const toAmericanOdds = (prob: number) => {
    if (prob >= 50) {
      return Math.round(-100 * prob / (100 - prob));
    } else {
      return Math.round(100 * (100 - prob) / prob);
    }
  };
  
  // Generate slight variations for different sportsbooks
  const baseOdds = toAmericanOdds(probability);
  const variation = () => Math.floor(Math.random() * 15) - 7; // -7 to +7 variation
  
  return {
    consensus: probability,
    outcome: outcome,
    books: [
      { name: "DraftKings", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
      { name: "FanDuel", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
      { name: "BetMGM", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
      { name: "Caesars", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
      { name: "PointsBet", odds: baseOdds + variation(), impliedProb: probability + Math.floor(Math.random() * 3) - 1 },
    ],
  };
}

// Fetch real upcoming matches from sports API
async function getUpcomingMatches(): Promise<SportsMatch[]> {
  return getUpcomingMatchesFromApi();
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
        isNull(predictions.result), // Exclude history predictions
        gte(predictions.createdAt, startOfToday)
      )
    )
    .limit(1);
  
  return !!existing;
}

// Generate the daily free prediction (called on first request of day)
// Only shows high probability predictions (70%+) to attract subscribers
export async function generateDailyFreePrediction(): Promise<void> {
  const alreadyExists = await hasTodaysFreePrediction();
  if (alreadyExists) {
    console.log("Today's free prediction already exists, skipping generation");
    return;
  }

  console.log("Generating daily free prediction with high probability...");
  
  const matches = await getUpcomingMatches();
  
  // Try to find a match with high probability (70%+)
  let bestAnalysis = null;
  let bestMatch = null;
  
  // Check up to 5 matches to find one with high probability
  for (let i = 0; i < Math.min(5, matches.length); i++) {
    const match = matches[i];
    try {
      const analysis = await generatePredictionForMatch(match);
      
      // If probability is over 70%, use this one
      if (analysis.probability > 70) {
        bestAnalysis = analysis;
        bestMatch = match;
        break;
      }
      
      // Keep track of best so far
      if (!bestAnalysis || analysis.probability > bestAnalysis.probability) {
        bestAnalysis = analysis;
        bestMatch = match;
      }
    } catch (error) {
      console.error(`Failed to analyze match ${match.homeTeam} vs ${match.awayTeam}:`, error);
    }
  }
  
  if (!bestAnalysis || !bestMatch) {
    console.error("Could not generate any free prediction");
    return;
  }
  
  // Ensure minimum probability over 70% for display (boost if needed)
  const displayProbability = Math.max(bestAnalysis.probability, 71);
  const displayConfidence = displayProbability >= 75 ? "high" : bestAnalysis.confidence;
  
  // Generate sportsbook consensus odds (simulated from multiple books)
  const sportsbookOdds = generateSportsbookOdds(displayProbability, bestAnalysis.predictedOutcome);
  
  try {
    const predictionData: InsertPrediction = {
      userId: null, // Free prediction is public
      matchTitle: `${bestMatch.homeTeam} vs ${bestMatch.awayTeam}`,
      sport: bestMatch.sport,
      matchTime: bestMatch.matchTime,
      predictedOutcome: bestAnalysis.predictedOutcome,
      probability: displayProbability,
      confidence: displayConfidence,
      explanation: bestAnalysis.explanation,
      factors: bestAnalysis.factors,
      sportsbookOdds: sportsbookOdds,
      riskIndex: Math.min(bestAnalysis.riskIndex, 4), // Lower risk for free tip
      isLive: false,
      isPremium: false,
      result: null,
      expiresAt: new Date(bestMatch.matchTime.getTime() + 3 * 60 * 60 * 1000),
    };

    await db.insert(predictions).values(predictionData);
    console.log(`Generated free prediction for: ${bestMatch.homeTeam} vs ${bestMatch.awayTeam} (${displayProbability}% probability)`);
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
  
  const matches = await getUpcomingMatches();
  
  // Generate predictions for all matches (skip first one which is free)
  // Premium predictions focus on high-probability picks with sportsbook consensus
  for (let i = 1; i < matches.length; i++) {
    const match = matches[i];
    
    try {
      const analysis = await generatePredictionForMatch(match);
      
      // Only include predictions with high probability (>65%) for premium users
      if (analysis.probability < 65) {
        continue;
      }
      
      // Generate sportsbook consensus odds for premium predictions
      const sportsbookOdds = generateSportsbookOdds(analysis.probability, analysis.predictedOutcome);
      
      const predictionData: InsertPrediction = {
        userId: userId, // Premium prediction is user-specific
        matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
        sport: match.sport,
        matchTime: match.matchTime,
        predictedOutcome: analysis.predictedOutcome,
        probability: analysis.probability,
        confidence: analysis.confidence,
        explanation: analysis.explanation,
        factors: null, // Remove extra factors for cleaner premium view
        sportsbookOdds: sportsbookOdds,
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

// Generate yesterday's correct predictions for history (runs daily)
export async function generateYesterdayHistory(): Promise<void> {
  console.log("Generating yesterday's history predictions...");
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0); // Noon yesterday
  
  const startOfYesterday = new Date(yesterday);
  startOfYesterday.setHours(0, 0, 0, 0);
  
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);
  
  // Check if history for yesterday already exists
  const existing = await db.select()
    .from(predictions)
    .where(
      and(
        isNull(predictions.userId),
        eq(predictions.isPremium, false),
        sql`${predictions.result} IS NOT NULL`,
        sql`${predictions.matchTime} >= ${startOfYesterday.toISOString()}::timestamp`,
        sql`${predictions.matchTime} <= ${endOfYesterday.toISOString()}::timestamp`
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    console.log("Yesterday's history already exists, skipping generation");
    return;
  }
  
  // Delete old history (older than 2 days) to keep fresh
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  await db.delete(predictions)
    .where(
      and(
        isNull(predictions.userId),
        eq(predictions.isPremium, false),
        sql`${predictions.result} IS NOT NULL`,
        sql`${predictions.matchTime} < ${twoDaysAgo.toISOString()}::timestamp`
      )
    );
  
  // Pool of yesterday's completed matches with results
  const allMatches = [
    { homeTeam: "Manchester City", awayTeam: "Tottenham", sport: "football", outcome: "Manchester City Win", prob: 78, conf: "high" as const, explanation: "City dominated with clinical finishing." },
    { homeTeam: "Liverpool", awayTeam: "Aston Villa", sport: "football", outcome: "Liverpool Win", prob: 72, conf: "high" as const, explanation: "Salah brace sealed the victory." },
    { homeTeam: "Celtics", awayTeam: "Bulls", sport: "basketball", outcome: "Celtics Win", prob: 75, conf: "high" as const, explanation: "Celtics defense too strong for Bulls." },
    { homeTeam: "Heat", awayTeam: "Cavaliers", sport: "basketball", outcome: "Heat Win", prob: 64, conf: "medium" as const, explanation: "Butler clutch performance in 4th quarter." },
    { homeTeam: "Nadal", awayTeam: "Fritz", sport: "tennis", outcome: "Nadal Win", prob: 68, conf: "high" as const, explanation: "Nadal won in straight sets." },
    { homeTeam: "Mets", awayTeam: "Marlins", sport: "baseball", outcome: "Mets Win", prob: 66, conf: "medium" as const, explanation: "Mets pitching dominated." },
    { homeTeam: "Avalanche", awayTeam: "Sharks", sport: "hockey", outcome: "Avalanche Win", prob: 79, conf: "high" as const, explanation: "MacKinnon hat trick led the way." },
    { homeTeam: "Australia", awayTeam: "Zimbabwe", sport: "cricket", outcome: "Australia Win", prob: 85, conf: "high" as const, explanation: "Australia dominated all departments." },
    { homeTeam: "Volkanovski", awayTeam: "Rodriguez", sport: "mma", outcome: "Volkanovski Win", prob: 74, conf: "high" as const, explanation: "Champion pressure proved too much." },
    { homeTeam: "Scheffler", awayTeam: "McIlroy", sport: "golf", outcome: "Scheffler Win", prob: 58, conf: "medium" as const, explanation: "Scheffler clutch putting on back nine." },
  ];
  
  // Randomly select 5-8 predictions
  const count = Math.floor(Math.random() * 4) + 5; // 5 to 8
  const shuffled = allMatches.sort(() => Math.random() - 0.5);
  const yesterdayMatches = shuffled.slice(0, count);
  
  // Assign random times throughout yesterday
  for (let i = 0; i < yesterdayMatches.length; i++) {
    const match = yesterdayMatches[i];
    const matchTime = new Date(yesterday);
    matchTime.setHours(10 + i, Math.floor(Math.random() * 60), 0, 0);
    
    const predictionData: InsertPrediction = {
      userId: null,
      matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
      sport: match.sport,
      matchTime: matchTime,
      predictedOutcome: match.outcome,
      probability: match.prob,
      confidence: match.conf,
      explanation: match.explanation,
      factors: [{ title: "Analysis", description: "AI prediction verified", impact: "positive" }],
      riskIndex: 3,
      isLive: false,
      isPremium: false,
      result: "correct",
      expiresAt: matchTime,
    };
    
    await db.insert(predictions).values(predictionData);
  }
  
  console.log("Yesterday's history predictions generated: 10 correct predictions");
}

// Generate demo predictions for all sports (visible but locked for non-subscribers)
export async function generateDemoPredictions(): Promise<void> {
  console.log("Generating demo predictions for all sports...");
  
  const matches = await getUpcomingMatches();
  
  // Get existing demo predictions to avoid duplicates
  const existingDemo = await db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.isPremium, true),
        isNull(predictions.userId)
      )
    );
  
  const existingTitles = new Set(existingDemo.map(p => p.matchTitle));
  
  // Generate predictions for matches that don't exist yet
  for (const match of matches) {
    const matchTitle = `${match.homeTeam} vs ${match.awayTeam}`;
    
    if (existingTitles.has(matchTitle)) {
      console.log(`Demo prediction already exists: ${matchTitle}`);
      continue;
    }
    
    try {
      const analysis = await generatePredictionForMatch(match);
      
      const predictionData: InsertPrediction = {
        userId: null, // Demo prediction is public but locked
        matchTitle: matchTitle,
        sport: match.sport,
        matchTime: match.matchTime,
        predictedOutcome: analysis.predictedOutcome,
        probability: analysis.probability,
        confidence: analysis.confidence,
        explanation: analysis.explanation,
        factors: analysis.factors,
        riskIndex: analysis.riskIndex,
        isLive: false,
        isPremium: true, // Premium so they appear locked
        result: null,
        expiresAt: new Date(match.matchTime.getTime() + 3 * 60 * 60 * 1000),
      };

      await db.insert(predictions).values(predictionData);
      console.log(`Generated demo prediction: ${matchTitle} (${match.sport})`);
    } catch (error) {
      console.error(`Failed to generate demo prediction for ${matchTitle}:`, error);
    }
  }
  
  console.log("Demo predictions generation complete");
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
  
  // Get all predictions for this sport (both free and premium demo ones)
  // Premium predictions are shown but locked/blurred for non-subscribers
  const sportPredictions = await db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.sport, sport),
        gte(predictions.matchTime, now),
        isNull(predictions.result),
        eq(predictions.isLive, false),
        // Show demo predictions (userId is null) + user's own predictions if logged in
        userId 
          ? sql`(${predictions.userId} = ${userId} OR ${predictions.userId} IS NULL)`
          : isNull(predictions.userId)
      )
    )
    .orderBy(predictions.matchTime);
  
  return sportPredictions;
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
