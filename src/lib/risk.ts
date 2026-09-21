// D4 — Risk score: one honest number from three local inputs (startup
// entries, flagged autorun items, Defender real-time state). Pure function
// so the Dashboard card and tests share the exact math. No backend, no
// network — inputs come from commands the app already calls.
import type { UndoDigest } from "./types";

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

export interface RiskTrendPoint {
  day: string;
  score: number;
}

// Risk v2 trend — per-day 0-100 scores from the undo digest's by_day counts.
//
// Formula: each day's count is fed through riskScore() as the autorunFlags
// term with the other inputs neutral (startup 3, defender on), i.e.
//   score(day) = 100 - min(40, count * 8).
// No second scale: the trend points live on the exact same scale as the
// Dashboard risk card, so a trend value is directly comparable to it.
// Range is 60-100 (the autorun term caps at -40); startup/defender state is
// a snapshot, not per-day data, so it cannot vary along the trend.
//
// NOTE on by_kind: the digest carries only lifetime by_kind totals, with no
// per-day kind split, so per-day threat-kind attribution is impossible from
// the digest alone. Counts here are all undo kinds (mostly benign cosmetic
// changes); a busy day scores lower exactly like a day with many flagged
// autoruns would. If Rust ever adds per-day kind splits, weight the
// threat kinds per day through the same riskScore terms.
export function riskTrend(digest: UndoDigest, days = 14): RiskTrendPoint[] {
  const entries = Object.entries(digest.by_day ?? {});
  if (digest.total === 0 || entries.length === 0) return [];
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const window = entries.slice(-Math.max(1, Math.floor(days)));
  return window.map(([day, count]) => {
    const n = Math.max(0, Math.floor(count));
    return {
      day,
      score: riskScore({ startup: 3, autorunFlags: n, defenderOn: true }).score,
    };
  });
}
