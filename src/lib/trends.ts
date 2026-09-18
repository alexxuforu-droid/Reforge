// X-6 — local activity trends. Buckets undo-log entries per day for the
// trailing window. Pure + timezone-local; the UI renders bars from this.
export interface DayBucket {
  label: string;
  count: number;
}

export function bucketByDay(entries: { ts: number }[], days = 14, nowSecs?: number): DayBucket[] {
  const now = new Date((nowSecs ?? Date.now() / 1000) * 1000);
  now.setHours(0, 0, 0, 0);
  const out: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 86400000);
    const next = day.getTime() + 86400000;
    const start = day.getTime() / 1000;
    const end = next / 1000;
    const count = entries.filter((e) => e.ts >= start && e.ts < end).length;
    out.push({ label: `${day.getMonth() + 1}/${day.getDate()}`, count });
  }
  return out;
}
