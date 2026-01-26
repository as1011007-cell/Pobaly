import { getApiUrl } from "./query-client";
import type { Prediction } from "@/types";

const apiUrl = getApiUrl();

interface ApiPrediction {
  id: number;
  matchTitle: string;
  sport: string;
  matchTime: string;
  predictedOutcome: string;
  probability: number;
  confidence: string;
  explanation: string;
  factors: any[] | null;
  riskIndex: number;
  isLive: boolean | null;
  isPremium: boolean | null;
  result: string | null;
  createdAt: string;
  expiresAt: string | null;
}

function mapApiPrediction(apiPred: ApiPrediction): Prediction {
  return {
    id: String(apiPred.id),
    matchTitle: apiPred.matchTitle,
    sport: apiPred.sport,
    matchTime: apiPred.matchTime,
    predictedOutcome: apiPred.predictedOutcome,
    probability: apiPred.probability,
    confidence: apiPred.confidence as "high" | "medium" | "low",
    explanation: apiPred.explanation,
    factors: apiPred.factors || undefined,
    riskIndex: apiPred.riskIndex,
    isLive: apiPred.isLive || false,
    isPremium: apiPred.isPremium || false,
    result: apiPred.result as "correct" | "incorrect" | undefined,
  };
}

export async function fetchFreeTip(): Promise<Prediction | null> {
  try {
    const response = await fetch(new URL("/api/predictions/free-tip", apiUrl).toString());
    const data = await response.json();
    return data.prediction ? mapApiPrediction(data.prediction) : null;
  } catch (error) {
    console.error("Error fetching free tip:", error);
    return null;
  }
}

export async function fetchPremiumPredictions(userId?: string, isPremium?: boolean): Promise<Prediction[]> {
  try {
    const url = new URL("/api/predictions/premium", apiUrl);
    if (userId) {
      url.searchParams.set("userId", userId);
    }
    url.searchParams.set("isPremium", isPremium ? "true" : "false");
    const response = await fetch(url.toString());
    const data = await response.json();
    return (data.predictions || []).map(mapApiPrediction);
  } catch (error) {
    console.error("Error fetching premium predictions:", error);
    return [];
  }
}

export async function fetchLivePredictions(userId?: string): Promise<Prediction[]> {
  try {
    const url = new URL("/api/predictions/live", apiUrl);
    if (userId) {
      url.searchParams.set("userId", userId);
    }
    const response = await fetch(url.toString());
    const data = await response.json();
    return (data.predictions || []).map(mapApiPrediction);
  } catch (error) {
    console.error("Error fetching live predictions:", error);
    return [];
  }
}

export async function fetchHistoryPredictions(userId?: string): Promise<Prediction[]> {
  try {
    const url = new URL("/api/predictions/history", apiUrl);
    if (userId) {
      url.searchParams.set("userId", userId);
    }
    const response = await fetch(url.toString());
    const data = await response.json();
    return (data.predictions || []).map(mapApiPrediction);
  } catch (error) {
    console.error("Error fetching history predictions:", error);
    return [];
  }
}

export async function fetchPredictionsBySport(sport: string, userId?: string, isPremium?: boolean): Promise<Prediction[]> {
  try {
    const url = new URL(`/api/predictions/sport/${sport}`, apiUrl);
    if (userId) {
      url.searchParams.set("userId", userId);
    }
    url.searchParams.set("isPremium", isPremium ? "true" : "false");
    const response = await fetch(url.toString());
    const data = await response.json();
    return (data.predictions || []).map(mapApiPrediction);
  } catch (error) {
    console.error("Error fetching predictions by sport:", error);
    return [];
  }
}

export async function fetchPredictionById(id: string): Promise<Prediction | null> {
  try {
    const response = await fetch(new URL(`/api/predictions/${id}`, apiUrl).toString());
    const data = await response.json();
    return data.prediction ? mapApiPrediction(data.prediction) : null;
  } catch (error) {
    console.error("Error fetching prediction:", error);
    return null;
  }
}

export async function generatePredictions(): Promise<boolean> {
  try {
    const response = await fetch(new URL("/api/predictions/generate", apiUrl).toString(), {
      method: "POST",
    });
    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error("Error generating predictions:", error);
    return false;
  }
}

export async function generatePremiumPredictionsForUser(userId: string): Promise<boolean> {
  try {
    const response = await fetch(new URL("/api/predictions/generate-premium", apiUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error("Error generating premium predictions:", error);
    return false;
  }
}

export async function fetchSportPredictionCounts(userId?: string, isPremium?: boolean): Promise<Record<string, number>> {
  try {
    const url = new URL("/api/predictions/counts", apiUrl);
    if (userId) {
      url.searchParams.set("userId", userId);
    }
    url.searchParams.set("isPremium", isPremium ? "true" : "false");
    const response = await fetch(url.toString());
    const data = await response.json();
    return data.counts || {};
  } catch (error) {
    console.error("Error fetching sport prediction counts:", error);
    return {};
  }
}
