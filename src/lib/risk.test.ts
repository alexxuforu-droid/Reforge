import { describe, expect, it } from "vitest";
import { riskScore, riskTrend } from "./risk";
import type { UndoDigest } from "./types";

function digest(byDay: Record<string, number>): UndoDigest {
  const total = Object.values(byDay).reduce((a, b) => a + b, 0);
  return { total, by_kind: {}, by_day: byDay, recent: [] };
}

describe("riskScore", () => {
  it("scores a clean machine high and a risky one low", () => {
    expect(riskScore({ startup: 2, autorunFlags: 0, defenderOn: true }).score).toBeGreaterThan(80);
    expect(riskScore({ startup: 14, autorunFlags: 5, defenderOn: false }).score).toBeLessThan(40);
  });
});

describe("riskTrend", () => {
  it("returns an empty array for an empty digest", () => {
    expect(riskTrend(digest({}))).toEqual([]);
    expect(
      riskTrend({ total: 0, by_kind: {}, by_day: { "2026-09-20": 3 }, recent: [] }),
    ).toEqual([]);
  });

  it("maps rising counts to falling scores on the riskScore scale", () => {
    const points = riskTrend(
      digest({ "2026-09-18": 0, "2026-09-19": 2, "2026-09-20": 6 }),
    );
    expect(points.map((p) => p.day)).toEqual(["2026-09-18", "2026-09-19", "2026-09-20"]);
    // Same math as riskScore with neutral startup/defender: 100 - min(40, n*8).
    expect(points.map((p) => p.score)).toEqual([100, 84, 60]);
    expect(points[0].score).toBeGreaterThan(points[1].score);
    expect(points[1].score).toBeGreaterThan(points[2].score);
  });

  it("is deterministic regardless of key insertion order", () => {
    const a = riskTrend(digest({ "2026-09-20": 5, "2026-09-18": 1, "2026-09-19": 3 }));
    const b = riskTrend(digest({ "2026-09-18": 1, "2026-09-19": 3, "2026-09-20": 5 }));
    expect(a).toEqual(b);
    expect(riskTrend(digest({ "2026-09-18": 1, "2026-09-19": 3, "2026-09-20": 5 }))).toEqual(a);
  });

  it("floors at 60 for very busy days and keeps the trailing window", () => {
    const byDay: Record<string, number> = {};
    for (let d = 1; d <= 20; d++) {
      byDay[`2026-09-${String(d).padStart(2, "0")}`] = d;
    }
    const points = riskTrend(digest(byDay), 14);
    expect(points).toHaveLength(14);
    expect(points[0].day).toBe("2026-09-07");
    expect(points[13].day).toBe("2026-09-20");
    expect(points[13].score).toBe(60);
  });
});
