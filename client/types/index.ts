export type Sport = "football" | "basketball" | "cricket" | "tennis";

export type ConfidenceLevel = "low" | "medium" | "high";

export interface SportsbookOdds {
  consensus: number;
  outcome: string;
  books: Array<{
    name: string;
    odds: number;
    impliedProb: number;
  }>;
}

export interface Prediction {
  id: string;
  matchTitle: string;
  sport: Sport;
  matchTime: string;
  predictedOutcome: string;
  probability: number;
  confidence: ConfidenceLevel;
  explanation: string;
  isLive: boolean;
  isPremium: boolean;
  factors?: PredictionFactor[];
  sportsbookOdds?: SportsbookOdds;
  riskIndex?: number;
  result?: "correct" | "incorrect" | "pending";
}

export interface PredictionFactor {
  title: string;
  description: string;
  impact: "positive" | "negative" | "neutral";
}

export interface User {
  id: string;
  email: string;
  name?: string;
  isPremium: boolean;
  subscriptionExpiry?: string;
}

export interface SportCategory {
  id: Sport;
  name: string;
  icon: string;
  predictionCount: number;
}
