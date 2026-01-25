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

export async function fetchPremiumPredictions(): Promise<Prediction[]> {
  try {
    const response = await fetch(new URL("/api/predictions/premium", apiUrl).toString());
    const data = await response.json();
    return (data.predictions || []).map(mapApiPrediction);
  } catch (error) {
    console.error("Error fetching premium predictions:", error);
    return [];
  }
}

export async function fetchLivePredictions(): Promise<Prediction[]> {
  try {
    const response = await fetch(new URL("/api/predictions/live", apiUrl).toString());
    const data = await response.json();
    return (data.predictions || []).map(mapApiPrediction);
  } catch (error) {
    console.error("Error fetching live predictions:", error);
    return [];
  }
}

export async function fetchHistoryPredictions(): Promise<Prediction[]> {
  try {
    const response = await fetch(new URL("/api/predictions/history", apiUrl).toString());
    const data = await response.json();
    return (data.predictions || []).map(mapApiPrediction);
  } catch (error) {
    console.error("Error fetching history predictions:", error);
    return [];
  }
}

export async function fetchPredictionsBySport(sport: string): Promise<Prediction[]> {
  try {
    const response = await fetch(new URL(`/api/predictions/sport/${sport}`, apiUrl).toString());
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
