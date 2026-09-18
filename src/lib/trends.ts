// X-6 — local activity trends. Buckets undo-log entries per day for the
// trailing window. Pure + timezone-local; the UI renders bars from this.
//
// Undo timestamps are MILLISECONDS (Date.now() / now_millis()); bounds are
// computed in seconds, so entries are normalized on the way in. A seconds
// timestamp still works (defensive: anything below 1e12 is treated as s).
export interface DayBucket {
  label: string;
  count: number;
}

const MS_CUTOFF = 1e12;

function toSecs(ts: number): number {
  return ts > MS_CUTOFF ? ts / 1000 : ts;
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
    const count = entries.filter((e) => {
      const t = toSecs(e.ts);
      return t >= start && t < end;
    }).length;
    out.push({ label: `${day.getMonth() + 1}/${day.getDate()}`, count });
  }
  return out;
}

export function bucketByMonth(entries: { ts: number }[], months = 6, nowSecs?: number): DayBucket[] {
  const now = new Date((nowSecs ?? Date.now() / 1000) * 1000);
  const out: DayBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime() / 1000;
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime() / 1000;
    out.push({
      label: new Date(start * 1000).toLocaleString("en-US", { month: "short" }),
      count: entries.filter((e) => {
        const t = toSecs(e.ts);
        return t >= start && t < end;
      }).length,
    });
  }
  return out;
}
