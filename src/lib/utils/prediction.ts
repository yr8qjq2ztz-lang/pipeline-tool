/**
 * Deal Prediction Scoring System
 * Analyzes deals and predicts closure likelihood based on multiple factors
 */

export interface DealScoreFactors {
  ageInDays: number;
  daysToClose: number;
  probability: number;
  hasDueAction: boolean;
  isDueActionOverdue: boolean;
  stageProgress: number; // 0-1
  valueScore: number; // Higher value = more confident
}

export interface PredictionScore {
  closureLikelihood: number; // 0-100
  riskFactors: string[];
  recommendedActions: string[];
  confidence: number; // 0-100
  trend: "improving" | "declining" | "stable";
}

export function calculatePredictionScore(factors: DealScoreFactors): PredictionScore {
  // Validate input factors
  if (!factors || typeof factors !== "object") {
    console.error("Prediction: Invalid factors object");
    return {
      closureLikelihood: 0,
      riskFactors: ["Invalid deal data"],
      recommendedActions: ["Update deal information"],
      confidence: 0,
      trend: "declining",
    };
  }

  // Validate and normalize numeric inputs
  const ageInDays = Number.isFinite(factors.ageInDays) && factors.ageInDays >= 0 ? factors.ageInDays : 0;
  const daysToClose = Number.isFinite(factors.daysToClose) ? factors.daysToClose : 30;
  const probability = Number.isFinite(factors.probability) ? Math.max(0, Math.min(100, factors.probability)) : 50;
  const stageProgress = Number.isFinite(factors.stageProgress) ? Math.max(0, Math.min(1, factors.stageProgress)) : 0.5;
  const valueScore = Number.isFinite(factors.valueScore) && factors.valueScore >= 0 ? factors.valueScore : 0;

  const riskFactors: string[] = [];
  const recommendedActions: string[] = [];
  let baseScore = probability;
  let confidence = 50;

  // Factor 1: Overdue actions are red flags
  if (factors.isDueActionOverdue) {
    baseScore = Math.max(0, baseScore - 20);
    riskFactors.push("Overdue next action");
    recommendedActions.push("Follow up immediately");
  } else if (factors.hasDueAction) {
    baseScore = Math.min(100, baseScore + 5);
    recommendedActions.push("Execute next action on schedule");
  }

  // Factor 2: Close date proximity
  if (daysToClose < 0) {
    baseScore = Math.max(0, baseScore - 25);
    riskFactors.push("Past close date");
    recommendedActions.push("Update close date or escalate");
  } else if (daysToClose < 7) {
    baseScore = Math.min(100, baseScore + 15);
    recommendedActions.push("Ensure all close conditions met");
  } else if (daysToClose < 30) {
    baseScore = Math.min(100, baseScore + 10);
  }

  // Factor 3: Deal age vs stage progress
  const expectedDaysPerStage = 30; // Average days per stage
  const expectedAge = (stageProgress + 0.5) * expectedDaysPerStage * 4;
  if (ageInDays > expectedAge * 1.5) {
    baseScore = Math.max(0, baseScore - 15);
    riskFactors.push("Stalled deal (longer than expected)");
    recommendedActions.push("Review deal strategy and requirements");
  } else if (ageInDays < expectedAge * 0.5) {
    baseScore = Math.min(100, baseScore + 10);
    recommendedActions.push("Maintain momentum");
  }

  // Factor 4: Value-based confidence
  // Higher value deals might have more scrutiny
  if (valueScore > 100000) {
    confidence = Math.min(100, confidence + 25);
    recommendedActions.push("Coordinate with stakeholders");
  } else if (valueScore < 10000) {
    confidence = Math.min(100, confidence + 10);
  }

  // Ensure baseScore is valid before calculating trend
  if (!Number.isFinite(baseScore) || baseScore < 0 || baseScore > 100) {
    baseScore = Math.max(0, Math.min(100, baseScore || 50));
  }

  // Calculate trend based on probability vs expected
  let trend: "improving" | "declining" | "stable" = "stable";
  if (baseScore > probability + 5) {
    trend = "improving";
  } else if (baseScore < probability - 5) {
    trend = "declining";
  }

  // Clamp score between 0-100
  const closureLikelihood = Math.max(0, Math.min(100, baseScore));

  // Add general action if none exist
  if (recommendedActions.length === 0) {
    recommendedActions.push("Move forward with next stage");
  }

  return {
    closureLikelihood,
    riskFactors,
    recommendedActions: recommendedActions.slice(0, 3), // Top 3 actions
    confidence: Math.max(0, Math.min(100, confidence)),
    trend,
  };
}

/**
 * Get color and styling for prediction score
 */
export function getScoreColor(score: number): string {
  // Validate score input
  if (!Number.isFinite(score)) {
    console.error("Prediction: Invalid score for color:", score);
    return "text-gray-600 dark:text-gray-400";
  }
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  if (normalizedScore >= 75) return "text-green-600 dark:text-green-400";
  if (normalizedScore >= 50) return "text-blue-600 dark:text-blue-400";
  if (normalizedScore >= 25) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function getScoreBgColor(score: number): string {
  // Validate score input
  if (!Number.isFinite(score)) {
    console.error("Prediction: Invalid score for bg color:", score);
    return "bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-900";
  }
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  if (normalizedScore >= 75) return "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900";
  if (normalizedScore >= 50) return "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900";
  if (normalizedScore >= 25) return "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900";
  return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900";
}

export function getScoreBadge(score: number): string {
  // Validate score input
  if (!Number.isFinite(score)) {
    console.error("Prediction: Invalid score for badge:", score);
    return "⚪ Unknown";
  }
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  if (normalizedScore >= 75) return "🟢 Strong";
  if (normalizedScore >= 50) return "🔵 Good";
  if (normalizedScore >= 25) return "🟡 Weak";
  return "🔴 At Risk";
}
