// perf-scan.mjs — Metric 3: scan throughput (GB/s) on a fixture tree.
//
// Builds a deterministic fixture tree under os.tmpdir() (default 260 files,
// ~310 MB: dup groups + unique files + tiny files below the 1MB prefilter),
// then times a Node port of the EXACT Rust cascade in
// src-tauri/src/duplicates.rs:
//   size-prefilter (min 1MB) -> quick_hash (len + first 64KB + last 64KB)
//   -> full_hash (entire file) for size+quick collisions.
// Reports files/s, GB/s, and group counts so the Rust-side parallel-walker
// change (V2 plan pillar) has a before number on identical fixtures.
// The fixture layout + hashing widths are the contract: keep them in sync
// with duplicates.rs or the comparison is meaningless.
//
// Usage: node scripts/perf-scan.mjs [--keep] [--files N] [--mb N]
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const QUICK_HEAD = 65536;
const QUICK_TAIL = 65536;

function quickHash(path, len) {
  const h = createHash("sha256");
  h.update(String(len));
  const fd = openSync(path, "r");
  try {
    const head = Buffer.alloc(Math.min(QUICK_HEAD, len));
    const n = readSync(fd, head, 0, head.length, 0);
    h.update(head.subarray(0, n));
    if (len > QUICK_HEAD + QUICK_TAIL) {
      const tail = Buffer.alloc(QUICK_TAIL);
      const m = readSync(fd, tail, 0, tail.length, len - QUICK_TAIL);
      h.update(tail.subarray(0, m));
    }
  } finally {
    closeSync(fd);
  }
  return h.digest("hex");
}

function fullHash(path) {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function buildFixture(dir, targetMb) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // 10 duplicate groups x 6 copies x 2MB = 120MB (the detectable waste)
  const blob = randomBytes(2 * 1024 * 1024);
  for (let g = 0; g < 10; g++) {
    const gbuf = Buffer.from(blob);
    gbuf[0] = g; gbuf[1] = g ^ 0xff;
    for (let c = 0; c < 6; c++) {
      mkdirSync(join(dir, `group${g}`), { recursive: true });
      writeFileSync(join(dir, `group${g}`, `copy${c}.bin`), gbuf);
    }
  }
  // unique 2MB files to fill up to targetMb
  const usedMb = 120;
  const uniqCount = Math.max(0, Math.round((targetMb - usedMb - 10) / 2));
  mkdirSync(join(dir, "unique"), { recursive: true });
  for (let i = 0; i < uniqCount; i++) {
    const b = randomBytes(2 * 1024 * 1024);
    b[0] = i & 0xff;
    writeFileSync(join(dir, "unique", `u${i}.bin`), b);
  }
  // 200 tiny files (below the 1MB prefilter — walker cost only)
  mkdirSync(join(dir, "tiny"), { recursive: true });
  for (let i = 0; i < 200; i++) writeFileSync(join(dir, "tiny", `t${i}.txt`), `tiny ${i}\n`);
}

function walkFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

export function measureScan({ fixtureMb = 310, keep = false } = {}) {
  const dir = join(tmpdir(), "reforge-perf-fixture");
  buildFixture(dir, fixtureMb);
  const files = walkFiles(dir);
  const minBytes = 1 * 1024 * 1024;
  const t0 = process.hrtime.bigint();
  const byKey = new Map();
  let scannedBytes = 0;
  for (const f of files) {
    const len = statSync(f).size;
    if (len < minBytes) continue;
    scannedBytes += len;
    const q = quickHash(f, len);
    const k = `${len}:${q}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(f);
  }
  let groups = 0;
  for (const [, paths] of byKey) {
    if (paths.length < 2) continue;
    const seen = new Map();
    let dupes = 0;
    for (const p of paths) {
      const h = fullHash(p);
      if (seen.has(h)) dupes++;
      else seen.set(h, p);
    }
    if (dupes > 0) groups++;
  }
  const t1 = process.hrtime.bigint();
  const secs = Number(t1 - t0) / 1e9;
  const gb = scannedBytes / 1024 ** 3;
  const result = {
    metric: "scan",
    fixtureDir: dir,
    files: files.length,
    scannedBytes,
    scannedGb: +gb.toFixed(2),
    secs: +secs.toFixed(2),
    gbPerSec: +(gb / secs).toFixed(2),
    filesPerSec: Math.round(files.length / secs),
    groups,
    cascade: "size-prefilter(1MB) -> quick(len+64K head+64K tail) -> full(sha256)",
    engine: "node-sequential (before: Rust WalkDir sequential; target: rayon parallel walker)",
  };
  if (!keep) rmSync(dir, { recursive: true, force: true });
  return result;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  const keep = process.argv.includes("--keep");
  const mbIx = process.argv.indexOf("--mb");
  const fixtureMb = mbIx >= 0 ? Number(process.argv[mbIx + 1]) : 310;
  console.log(JSON.stringify(measureScan({ keep, fixtureMb }), null, 2));
}
