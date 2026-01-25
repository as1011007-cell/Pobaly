import { Prediction, SportCategory } from "@/types";

export const sportCategories: SportCategory[] = [
  { id: "football", name: "Football", icon: "dribbble", predictionCount: 12 },
  { id: "basketball", name: "Basketball", icon: "circle", predictionCount: 8 },
  { id: "cricket", name: "Cricket", icon: "target", predictionCount: 6 },
  { id: "tennis", name: "Tennis", icon: "activity", predictionCount: 5 },
];

const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

export const mockPredictions: Prediction[] = [
  {
    id: "free-tip-1",
    matchTitle: "Manchester United vs Liverpool",
    sport: "football",
    matchTime: tomorrow.toISOString(),
    predictedOutcome: "Liverpool Win or Draw",
    probability: 78,
    confidence: "high",
    explanation:
      "Liverpool's recent form and strong away record against United makes them favorites. Key injuries to United's midfield further strengthen this prediction.",
    isLive: false,
    isPremium: false,
    factors: [
      {
        title: "Recent Form",
        description: "Liverpool unbeaten in last 8 matches",
        impact: "positive",
      },
      {
        title: "Head to Head",
        description: "Liverpool won 4 of last 5 meetings",
        impact: "positive",
      },
      {
        title: "Injuries",
        description: "United missing 3 key midfielders",
        impact: "positive",
      },
    ],
    riskIndex: 22,
  },
  {
    id: "premium-1",
    matchTitle: "Real Madrid vs Barcelona",
    sport: "football",
    matchTime: tomorrow.toISOString(),
    predictedOutcome: "Over 2.5 Goals",
    probability: 82,
    confidence: "high",
    explanation:
      "El Clasico matches historically produce high-scoring games. Both teams have strong attacking lineups and defensive vulnerabilities.",
    isLive: false,
    isPremium: true,
    riskIndex: 18,
  },
  {
    id: "premium-2",
    matchTitle: "Lakers vs Celtics",
    sport: "basketball",
    matchTime: now.toISOString(),
    predictedOutcome: "Lakers +5.5",
    probability: 71,
    confidence: "medium",
    explanation:
      "Lakers performing well at home. Celtics on back-to-back games which typically affects performance.",
    isLive: true,
    isPremium: true,
    riskIndex: 29,
  },
  {
    id: "premium-3",
    matchTitle: "India vs Australia",
    sport: "cricket",
    matchTime: tomorrow.toISOString(),
    predictedOutcome: "India Win",
    probability: 65,
    confidence: "medium",
    explanation:
      "India's home advantage and spin-friendly conditions favor their bowling attack.",
    isLive: false,
    isPremium: true,
    riskIndex: 35,
  },
  {
    id: "premium-4",
    matchTitle: "Djokovic vs Alcaraz",
    sport: "tennis",
    matchTime: tomorrow.toISOString(),
    predictedOutcome: "Alcaraz in 4 Sets",
    probability: 58,
    confidence: "low",
    explanation:
      "Close matchup but Alcaraz's recent form on hard courts gives him a slight edge.",
    isLive: false,
    isPremium: true,
    riskIndex: 42,
  },
  {
    id: "live-1",
    matchTitle: "Bayern Munich vs Dortmund",
    sport: "football",
    matchTime: now.toISOString(),
    predictedOutcome: "Next Goal: Bayern",
    probability: 62,
    confidence: "medium",
    explanation:
      "Bayern dominating possession and creating more chances. Current score 1-1.",
    isLive: true,
    isPremium: true,
    riskIndex: 38,
  },
  {
    id: "history-1",
    matchTitle: "Arsenal vs Chelsea",
    sport: "football",
    matchTime: yesterday.toISOString(),
    predictedOutcome: "Arsenal Win",
    probability: 72,
    confidence: "high",
    explanation: "Arsenal's home form was exceptional this season.",
    isLive: false,
    isPremium: false,
    result: "correct",
    riskIndex: 28,
  },
  {
    id: "history-2",
    matchTitle: "Warriors vs Bucks",
    sport: "basketball",
    matchTime: yesterday.toISOString(),
    predictedOutcome: "Over 220.5",
    probability: 68,
    confidence: "medium",
    explanation: "Both teams averaging high scores in recent games.",
    isLive: false,
    isPremium: true,
    result: "incorrect",
    riskIndex: 32,
  },
];

export const getFreeTip = (): Prediction | null => {
  return mockPredictions.find((p) => !p.isPremium && !p.result) || null;
};

export const getPremiumPredictions = (): Prediction[] => {
  return mockPredictions.filter((p) => p.isPremium && !p.result && !p.isLive);
};

export const getLivePredictions = (): Prediction[] => {
  return mockPredictions.filter((p) => p.isLive);
};

export const getHistoryPredictions = (): Prediction[] => {
  return mockPredictions.filter((p) => p.result === "correct");
};

export const getPredictionsBySport = (sport: string): Prediction[] => {
  return mockPredictions.filter(
    (p) => p.sport === sport && !p.result && !p.isLive,
  );
};
