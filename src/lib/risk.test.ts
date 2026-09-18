import { describe, expect, it } from "vitest";
import { riskScore } from "./risk";

describe("riskScore", () => {
  it("scores a clean machine high and a risky one low", () => {
    expect(riskScore({ startup: 2, autorunFlags: 0, defenderOn: true }).score).toBeGreaterThan(80);
    expect(riskScore({ startup: 14, autorunFlags: 5, defenderOn: false }).score).toBeLessThan(40);
  });
});
