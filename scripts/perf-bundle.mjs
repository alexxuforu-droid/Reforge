// perf-bundle.mjs — Metric 4: bundle weight / parse time.
//
// Sums dist/assets output (*.js / *.css), flags the V2-plan lazy-load
// candidates (whip/fun chunks, mock dev chunk), and audits the two heavy
// Rust deps the plan names (symphonia formats, image formats). Also records
// the release exe size when present (320MB ffmpeg-sidecar trade documented
// in docs/DELIVERY.md — a known floor, not a target).
//
// Usage: node scripts/perf-bundle.mjs [--json]
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function dirSize(dir) {
  let total = 0;
  const files = [];
  if (!existsSync(dir)) return { total, files };
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isFile()) { total += st.size; files.push({ name: e, bytes: st.size }); }
  }
  files.sort((a, b) => b.bytes - a.bytes);
  return { total, files };
}

export function measureBundle() {
  const assets = dirSize(join(root, "dist", "assets"));
  const js = assets.files.filter((f) => f.name.endsWith(".js"));
  const css = assets.files.filter((f) => f.name.endsWith(".css"));
  const jsBytes = js.reduce((a, f) => a + f.bytes, 0);
  const cssBytes = css.reduce((a, f) => a + f.bytes, 0);
  const find = (re) => assets.files.filter((f) => re.test(f.name));
  const candidates = {
    whip: find(/whip/i),
    fun: find(/^(fire|pet|confetti|glitch|rage|roast|smash|boss|bsod|quiz|particles)-/i),
    mock: find(/^mock-/i),
    makeover: find(/^Makeover-/i),
  };
  // Cargo dep audit: which format features are compiled in
  let cargo = "";
  try { cargo = readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8"); } catch { /* no cargo */ }
  const symphonia = (cargo.match(/symphonia\s*=\s*\{[^}]*\}/s) || ["n/a"])[0].replace(/\s+/g, " ");
  const image = (cargo.match(/image\s*=\s*\{[^}]*\}/s) || ["n/a"])[0].replace(/\s+/g, " ");
  // release exe when present
  let exeBytes = null;
  for (const p of [join(root, "src-tauri", "target", "release", "reforge.exe"), join(root, "dist", "reforge.exe")]) {
    try { if (existsSync(p)) { exeBytes = statSync(p).size; break; } } catch { /* miss */ }
  }
  return {
    metric: "bundle",
    distAssetsBytes: assets.total,
    jsBytes,
    cssBytes,
    jsFiles: js.length,
    top10: assets.files.slice(0, 10),
    lazyCandidates: {
      whipBytes: candidates.whip.reduce((a, f) => a + f.bytes, 0),
      funBytes: candidates.fun.reduce((a, f) => a + f.bytes, 0),
      mockBytes: candidates.mock.reduce((a, f) => a + f.bytes, 0),
      makeoverBytes: candidates.makeover.reduce((a, f) => a + f.bytes, 0),
      whipFiles: candidates.whip.map((f) => f.name),
      funFiles: candidates.fun.map((f) => f.name),
    },
    rustDepAudit: { symphonia, image },
    exeBytes,
    note: "exe floor documented in docs/DELIVERY.md (ffmpeg sidecar); not a target",
  };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  console.log(JSON.stringify(measureBundle(), null, 2));
}
