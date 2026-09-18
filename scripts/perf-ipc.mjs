// perf-ipc.mjs — Metric 2: IPC round-trips + bytes on hot paths.
//
// Two halves, both static (no running exe needed):
//  1. Round-trip counts per view mount: counts useLoad/useLazyLoad/call(
//     sites in each src/views/*.tsx. Dashboard + Makeover are the hot paths
//     the V2 plan calls out (4-8 sequential round-trips per view mount).
//  2. Undo payload weight: synthesizes a 200-entry undo log WITH data blobs
//     (today's get_undo_log shape) vs a counts-by-day/kind digest (the
//     proposed get_undo_digest shape) and reports both byte sizes + ratio.
//
// Usage: node scripts/perf-ipc.mjs [--json]
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viewsDir = join(root, "src", "views");

function countLoads(src) {
  const useLoad = (src.match(/useLoad\s*[<(]/g) || []).length;
  const useLazy = (src.match(/useLazyLoad\s*[<(]/g) || []).length;
  // call<...>( / call(" — exclude import lines and mock internals
  const calls = (src.match(/(?<![A-Za-z_])call\s*(<|\()/g) || []).length;
  return { useLoad, useLazy, call: calls, total: useLoad + useLazy + calls };
}

export function measureRoundTrips() {
  const perView = {};
  let total = 0;
  // Recursive: view subdirectories (e.g. views/makeover/*.ts hooks) hold
  // real mount-time loads too — counting only top-level files would let a
  // pure refactor move the number without changing any behavior.
  const walkViews = (d, prefix = "") => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const key = prefix + e.name;
      if (e.isDirectory()) { walkViews(p, key + "/"); continue; }
      if (!key.endsWith(".tsx") && !key.endsWith(".ts")) continue;
      if (key.endsWith(".test.tsx") || key.endsWith(".test.ts")) continue;
      const src = readFileSync(p, "utf8");
      const c = countLoads(src);
      perView[key] = c;
      total += c.total;
    }
  };
  walkViews(viewsDir);
  // get_undo_log fan-out: how many files fetch the full log with blobs.
  // V2 pillar 2a: the mock implementation (dispatcher + src/lib/mock/
  // handlers) *serves* the command — it is not a caller. Exclude it, and
  // exclude the handlers' internal `call()` recursion the same way.
  const isMockImpl = (p) => {
    const n = p.replace(/\\/g, "/");
    return n.endsWith("src/lib/mock.ts") || n.includes("src/lib/mock/");
  };
  let undoCallSites = 0;
  const grepDirs = [join(root, "src", "views"), join(root, "src", "lib"), join(root, "src", "features")];
  const walk = (d) => {
    let hits = 0;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { hits += walk(p); continue; }
      if (!/\.(tsx?)$/.test(e.name) || e.name.includes(".test.")) continue;
      if (isMockImpl(p)) continue;
      const src = readFileSync(p, "utf8");
      hits += (src.match(/get_undo_log/g) || []).length;
    }
    return hits;
  };
  for (const d of grepDirs) {
    try { undoCallSites += walk(d); } catch { /* dir may not exist */ }
  }
  return { perView, totalRoundTripSites: total, getUndoLogSites: undoCallSites };
}

// Synthetic 200-entry log: kinds mirror dashboard.rs match arms; data blobs
// mirror real shapes (moves[] arrays for sort/archive, freed bytes for junk,
// registry bytes for startup_disable). Sizes are representative, not exact.
function synthFullLog(n = 200) {
  const entries = [];
  for (let i = 0; i < n; i++) {
    const kind = ["junk_clean", "sort", "archive", "rename", "startup_disable", "accent"][i % 6];
    let data;
    if (kind === "sort" || kind === "archive") {
      data = { moves: Array.from({ length: 40 }, (_, j) => ({ from: `C:\\Users\\u\\Downloads\\file${i}_${j}.tmp`, to: `C:\\Users\\u\\Docs\\file${i}_${j}.tmp` })) };
    } else if (kind === "rename") {
      data = { ops: Array.from({ length: 25 }, (_, j) => ({ from: `a${i}_${j}.png`, to: `b${i}_${j}.png` })) };
    } else if (kind === "startup_disable") {
      data = { name: `Updater${i}`, location: "HKCU Run", bytes: Array.from({ length: 120 }, (_, j) => j % 256), vtype: "sz" };
    } else {
      data = { freed: 1024 * 1024 * (i % 50), extra: "x".repeat(200) };
    }
    entries.push({ id: `id-${i}`, ts: 1758000000000 + i * 1000, kind, description: `entry ${i} description text here`, revertible: true, undone: false, data });
  }
  return entries;
}

function synthDigest(entries) {
  const byDayKind = {};
  for (const e of entries) {
    const day = Math.floor(e.ts / 86400000);
    const k = `${day}:${e.kind}`;
    byDayKind[k] = (byDayKind[k] || 0) + 1;
  }
  return { total: entries.length, byDayKind, recent: entries.slice(-5).map((e) => ({ id: e.id, ts: e.ts, kind: e.kind, description: e.description })) };
}

export function measureUndoBytes() {
  const full = synthFullLog(200);
  const fullBytes = Buffer.byteLength(JSON.stringify(full));
  const digest = synthDigest(full);
  const digestBytes = Buffer.byteLength(JSON.stringify(digest));
  return { fullLogBytes: fullBytes, digestBytes, ratio: +(fullBytes / digestBytes).toFixed(1), entries: 200 };
}

export function measureIpc() {
  return { roundTrips: measureRoundTrips(), payload: measureUndoBytes() };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  console.log(JSON.stringify(measureIpc(), null, 2));
}
