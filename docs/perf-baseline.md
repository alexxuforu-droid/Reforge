# Perf baseline — V2 plan pillar 1 (stamped 2026-09-18)

Harness: `node scripts/perf-run.mjs [--baseline]`. Four scripts, one per
user-felt metric in `docs/V2-PLAN.md`. Full numbers in
`docs/perf-baseline.json`; this file is the human-readable cut.

## Before numbers (this machine, warm)

| # | Metric | Before | Target mechanism |
|---|---|---|---|
| 1 | Boot / first paint (deferred ms) | 2ms (budget 8000ms) | Composite `get_dashboard_summary` + parallel `useLoad` |
| 2 | IPC round-trip sites (views total) / `get_undo_log` sites | 275 / 4* | `get_undo_digest` instead of full 200-entry log |
| 2b | Full 200-log bytes vs digest bytes | 328.9 KB vs 0.6 KB (**507x**) | Same as above — the single biggest bytes win |
| 3 | Scan throughput | 0.66 GB/s, 1462 files/s (0.12GB fixture) | Size-prefilter → partial-hash → full-hash + parallel walker |
| 4 | Bundle: dist/assets total (js / css) | 998 KB (935 / 63) | Lazy-load whip/fun; audit `symphonia` + `image` features |
| 4b | Lazy candidates: whip / fun / mock / makeover | 96 / 48 / 75 / 85 KB | Whip + fun off the critical path first |

Mount-time detail (what the user feels — eager `useLoad` only, not handler
`call()` sites): **Dashboard 4, Makeover 6** — matches the plan's "4–8
sequential round-trips per view mount". Makeover additionally holds 18
`useLazyLoad` sections (already deferred) and ~59 handler `call()` sites
(not mount cost). Gaming 5 / Settings 10 / Security 6 eager loads are the
next composite-command candidates after Dashboard.

\* Re-stamped after pillar 2a (mock.ts split): the mock implementation
(`src/lib/mock.ts` + `src/lib/mock/`) *serves* `get_undo_log` — it was
wrongly counted as a caller before (5 → 4). Round-trip total unchanged at
275, confirming the split added/removed no call sites.

Known floors (do not chase): Tauri/WebView2 init, raw Windows API latency,
the ~320MB exe (ffmpeg sidecar — `docs/DELIVERY.md` §3). Boot's 2ms is the
deferred-startup slice from the on-disk log (warm); a true cold-start number
needs a headed machine.

## How to re-run

```sh
node scripts/perf-run.mjs --baseline --scan-mb 120  # re-stamp after a pillar
node scripts/perf-run.mjs --scan-mb 120             # diff vs baseline, fails on regression
node scripts/perf-boot.mjs                          # metric 1 alone
node scripts/perf-ipc.mjs                           # metric 2 alone
node scripts/perf-scan.mjs --mb 120                 # metric 3 alone
node scripts/perf-bundle.mjs                        # metric 4 alone
```

Regression gate: boot over budget, round-trip sites up, scan GB/s down >10%,
or bundle up >5% fails the run. Wired into `scripts/test-ci.sh`.
