// D4 — Risk score: one honest number from three local inputs (startup
// entries, flagged autorun items, Defender real-time state). Pure function
// so the Dashboard card and tests share the exact math. No backend, no
// network — inputs come from commands the app already calls.
export interface RiskInput {
  startup: number;
  autorunFlags: number;
  defenderOn: boolean;
}

export type RiskLevel = "low" | "medium" | "high";

export function riskScore(input: RiskInput): { score: number; level: RiskLevel } {
  let score = 100;
  score -= Math.min(30, Math.max(0, input.startup - 3) * 3);
  score -= Math.min(40, input.autorunFlags * 8);
  if (!input.defenderOn) score -= 30;
  score = Math.max(0, score);
  return { score, level: score >= 75 ? "low" : score >= 40 ? "medium" : "high" };
}
