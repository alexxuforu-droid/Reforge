// perf-boot.mjs — Metric 1: boot / first paint.
//
// Parses the "deferred startup: done in Nms" line out of startup.log
// (same source as scripts/check-startup-budget.sh) and emits JSON.
// Skips (ok:true, skipped:true) when no log exists — CI never produces one.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function logPath(arg) {
  if (arg) return arg;
  const appdata = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
  return join(appdata, "com.reforge.app", "startup.log");
}

export function measureBoot(logArg, budgetMs = 8000) {
  const log = logPath(logArg);
  if (!existsSync(log)) {
    return { metric: "boot", ok: true, skipped: true, log, reason: "no startup.log — run the release exe once" };
  }
  const text = readFileSync(log, "utf8");
  const lines = text.match(/deferred startup: done in (\d+)ms/g) || [];
  if (lines.length === 0) {
    return { metric: "boot", ok: false, log, reason: "no 'deferred startup: done in Nms' line" };
  }
  const ms = Number(lines[lines.length - 1].match(/(\d+)ms/)[1]);
  return { metric: "boot", ok: ms <= budgetMs, ms, budgetMs, log, samples: lines.length };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`.replace("///", "///")) {
  const out = measureBoot(process.argv[2], Number(process.argv[3] || 8000));
  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exit(1);
}
