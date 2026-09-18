import { describe, expect, it } from "vitest";
import { bucketByDay, bucketByMonth } from "./trends";

const DAY_S = 86400;
const DAY_MS = 86400000;

// Undo timestamps are milliseconds (Date.now()); the day test uses second
// precision around a fixed clock, the ms test uses realistic magnitudes.
describe("bucketByDay", () => {
  it("counts entries per day over the trailing window", () => {
    const now = 1_700_000_000;
    const entries = [
      { ts: now - 10 },
      { ts: now - 20 },
      { ts: now - DAY_S - 5 },
      { ts: now - 3 * DAY_S },
      { ts: now - 30 * DAY_S },
    ];
    const buckets = bucketByDay(entries, 7, now);
    expect(buckets).toHaveLength(7);
    expect(buckets[6].count).toBe(2);
    expect(buckets[5].count).toBe(1);
    expect(buckets[3].count).toBe(1);
    expect(buckets[0].count).toBe(0);
    expect(buckets.reduce((a, b) => a + b.count, 0)).toBe(4);
  });

  it("counts millisecond timestamps (the real undo-log unit)", () => {
    const nowMs = new Date(2026, 8, 18, 12).getTime();
    const now = nowMs / 1000;
    const entries = [
      { ts: nowMs - 10_000 },
      { ts: nowMs - DAY_MS - 5_000 },
      { ts: nowMs - 30 * DAY_MS },
    ];
    const buckets = bucketByDay(entries, 7, now);
    expect(buckets[6].count).toBe(1);
    expect(buckets[5].count).toBe(1);
    expect(buckets.reduce((a, b) => a + b.count, 0)).toBe(2);
  });

  it("returns zeroed buckets for an empty log", () => {
    const buckets = bucketByDay([], 14, 1_700_000_000);
    expect(buckets).toHaveLength(14);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("bucketByMonth", () => {
  it("buckets entries per calendar month", () => {
    const now = new Date(2026, 8, 18).getTime() / 1000;
    const entries = [{ ts: now - 10 }, { ts: now - 40 * 86400 }, { ts: now - 200 * 86400 }];
    const buckets = bucketByMonth(entries, 6, now);
    expect(buckets).toHaveLength(6);
    expect(buckets[5].count).toBe(1);
    expect(buckets.reduce((a, b) => a + b.count, 0)).toBe(2);
  });

  it("counts millisecond timestamps (the real undo-log unit)", () => {
    const nowMs = new Date(2026, 8, 18).getTime();
    const now = nowMs / 1000;
    const entries = [{ ts: nowMs - 10_000 }, { ts: nowMs - 200 * DAY_MS }];
    const buckets = bucketByMonth(entries, 6, now);
    expect(buckets).toHaveLength(6);
    expect(buckets[5].count).toBe(1);
    expect(buckets.reduce((a, b) => a + b.count, 0)).toBe(1);
  });
});
