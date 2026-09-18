// perf-run.mjs — V2 plan pillar 1 runner: all four user-felt metrics in one go.
//
//   node scripts/perf-run.mjs [--baseline] [--scan-mb N]
//
// Writes docs/perf-baseline.json (full numbers) and prints a markdown table
// for docs/perf-baseline.md. --baseline stamps the file as the comparison
// point; without it the run diffs against the stamped baseline and exits 1
// on regression (boot over budget, round-trips up, GB/s down, bytes up).
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { measureBoot } from "./perf-boot.mjs";
import { measureIpc } from "./perf-ipc.mjs";
import { measureScan } from "./perf-scan.mjs";
import { measureBundle } from "./perf-bundle.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outJson = join(root, "docs", "perf-baseline.json");

const args = process.argv.slice(2);
const wantBaseline = args.includes("--baseline");
const mbIx = args.indexOf("--scan-mb");
const scanMb = mbIx >= 0 ? Number(args[mbIx + 1]) : 120; // small default for CI speed

const boot = measureBoot(undefined, 8000);
const ipc = measureIpc();
const scan = measureScan({ fixtureMb: scanMb });
const bundle = measureBundle();

const run = {
  ts: new Date().toISOString(),
  scanFixtureMb: scanMb,
  boot, ipc, scan, bundle,
};

function mdTable(r) {
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  return [
    "| # | Metric | Before | After | x |",
    "|---|---|---|---|---|",
    `| 1 | Boot / first paint (deferred ms) | ${r.boot.ms ?? r.boot.reason ?? "skip"} | — | — |`,
    `| 2 | IPC: round-trip sites (views total) / get_undo_log sites | ${r.ipc.roundTrips.totalRoundTripSites} / ${r.ipc.roundTrips.getUndoLogSites} | — | — |`,
    `| 2b | IPC: full 200-log bytes vs digest bytes (ratio) | ${kb(r.ipc.payload.fullLogBytes)} vs ${kb(r.ipc.payload.digestBytes)} (${r.ipc.payload.ratio}x) | — | — |`,
    `| 3 | Scan throughput (GB/s, ${r.scan.scannedGb}GB fixture) | ${r.scan.gbPerSec} GB/s (${r.scan.filesPerSec} files/s) | — | — |`,
    `| 4 | Bundle: dist/assets total (js / css) | ${kb(r.bundle.distAssetsBytes)} (${kb(r.bundle.jsBytes)} / ${kb(r.bundle.cssBytes)}) | — | — |`,
    `| 4b | Lazy candidates: whip / fun / mock / makeover | ${kb(r.bundle.lazyCandidates.whipBytes)} / ${kb(r.bundle.lazyCandidates.funBytes)} / ${kb(r.bundle.lazyCandidates.mockBytes)} / ${kb(r.bundle.lazyCandidates.makeoverBytes)} | — | — |`,
  ].join("\n");
}

if (wantBaseline) {
  writeFileSync(outJson, JSON.stringify(run, null, 2));
  console.log(`stamped ${outJson}`);
  console.log(mdTable(run));
  process.exit(0);
}

if (!existsSync(outJson)) {
  console.log(JSON.stringify(run, null, 2));
  console.log("\nNo baseline stamped yet — run: node scripts/perf-run.mjs --baseline");
  process.exit(0);
}

const base = JSON.parse(readFileSync(outJson, "utf8"));
const fails = [];
if (!boot.skipped && !boot.ok) fails.push(`boot ${boot.ms}ms over ${8000}ms budget`);
if (ipc.roundTrips.totalRoundTripSites > base.ipc.roundTrips.totalRoundTripSites)
  fails.push(`round-trip sites rose ${base.ipc.roundTrips.totalRoundTripSites} -> ${ipc.roundTrips.totalRoundTripSites}`);
if (scan.gbPerSec < base.scan.gbPerSec * 0.9)
  fails.push(`scan GB/s regressed ${base.scan.gbPerSec} -> ${scan.gbPerSec}`);
if (bundle.distAssetsBytes > base.bundle.distAssetsBytes * 1.05)
  fails.push(`bundle grew ${(base.bundle.distAssetsBytes / 1024).toFixed(0)}KB -> ${(bundle.distAssetsBytes / 1024).toFixed(0)}KB`);
console.log(JSON.stringify({ base: base.ts, now: run.ts, fails }, null, 2));
console.log(mdTable(run));
if (fails.length) { console.error(`perf-run: REGRESSION — ${fails.join("; ")}`); process.exit(1); }
console.log("perf-run: OK");
