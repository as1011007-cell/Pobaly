import OpenAI from "openai";
import { db } from "../db";
import { predictions, type InsertPrediction } from "@shared/schema";
import { eq, and, gte, isNull, desc } from "drizzle-orm";

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

const UPCOMING_MATCHES: SportsMatch[] = [
  { homeTeam: "Manchester United", awayTeam: "Liverpool", sport: "football", matchTime: new Date(Date.now() + 24 * 60 * 60 * 1000), league: "Premier League" },
  { homeTeam: "Real Madrid", awayTeam: "Barcelona", sport: "football", matchTime: new Date(Date.now() + 48 * 60 * 60 * 1000), league: "La Liga" },
  { homeTeam: "Bayern Munich", awayTeam: "Dortmund", sport: "football", matchTime: new Date(Date.now() + 36 * 60 * 60 * 1000), league: "Bundesliga" },
  { homeTeam: "Lakers", awayTeam: "Celtics", sport: "basketball", matchTime: new Date(Date.now() + 12 * 60 * 60 * 1000), league: "NBA" },
  { homeTeam: "Warriors", awayTeam: "Bucks", sport: "basketball", matchTime: new Date(Date.now() + 18 * 60 * 60 * 1000), league: "NBA" },
  { homeTeam: "India", awayTeam: "Australia", sport: "cricket", matchTime: new Date(Date.now() + 72 * 60 * 60 * 1000), league: "Test Series" },
  { homeTeam: "Djokovic", awayTeam: "Alcaraz", sport: "tennis", matchTime: new Date(Date.now() + 96 * 60 * 60 * 1000), league: "ATP Tour" },
  { homeTeam: "Arsenal", awayTeam: "Chelsea", sport: "football", matchTime: new Date(Date.now() + 60 * 60 * 60 * 1000), league: "Premier League" },
];

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

export async function generateDailyPredictions(): Promise<void> {
  console.log("Generating daily predictions...");
  
  for (let i = 0; i < Math.min(UPCOMING_MATCHES.length, 8); i++) {
    const match = UPCOMING_MATCHES[i];
    
    try {
      const analysis = await generatePredictionForMatch(match);
      
      const predictionData: InsertPrediction = {
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
        isPremium: i > 0,
        result: null,
        expiresAt: new Date(match.matchTime.getTime() + 3 * 60 * 60 * 1000),
      };

      await db.insert(predictions).values(predictionData);
      console.log(`Generated prediction for: ${match.homeTeam} vs ${match.awayTeam}`);
    } catch (error) {
      console.error(`Failed to generate prediction for ${match.homeTeam} vs ${match.awayTeam}:`, error);
    }
  }
  
  console.log("Daily predictions generation complete");
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

export async function getFreeTip() {
  const now = new Date();
  const [freeTip] = await db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.isPremium, false),
        gte(predictions.matchTime, now),
        isNull(predictions.result)
      )
    )
    .orderBy(predictions.matchTime)
    .limit(1);
  
  return freeTip || null;
}

export async function getPremiumPredictions() {
  const now = new Date();
  return db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.isPremium, true),
        eq(predictions.isLive, false),
        gte(predictions.matchTime, now),
        isNull(predictions.result)
      )
    )
    .orderBy(predictions.matchTime);
}

export async function getLivePredictions() {
  return db.select()
    .from(predictions)
    .where(eq(predictions.isLive, true))
    .orderBy(predictions.matchTime);
}

export async function getHistoryPredictions() {
  return db.select()
    .from(predictions)
    .where(eq(predictions.result, "correct"))
    .orderBy(desc(predictions.matchTime));
}

export async function getPredictionsBySport(sport: string) {
  const now = new Date();
  return db.select()
    .from(predictions)
    .where(
      and(
        eq(predictions.sport, sport),
        gte(predictions.matchTime, now),
        isNull(predictions.result),
        eq(predictions.isLive, false)
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
