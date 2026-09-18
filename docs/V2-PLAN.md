# Reforge v2.0 Plan — recorded 2026-09-18

Owner direction: keep the proposed order, take **all five** product bets, and treat
performance as the headline goal.

## Performance target (owner's words)

> "like the performance is very bad an acceptable amount of times better would be like 5-20x"

Accepted reading: **5–20x combined improvement across the four user-felt metrics below**,
each measured before/after with the perf harness. No single change is expected to
deliver 20x alone; the sum of the four must land in the 5–20x band.

| # | Metric | How measured | Target mechanism |
|---|---|---|---|
| 1 | Boot / first paint | startup.log timing + IPC timing log | Composite `get_dashboard_summary` command + parallel `useLoad` (today: 4–8 sequential round-trips per view mount) |
| 2 | IPC bytes on hot paths | IPC timing log | `get_undo_digest` (counts by day/kind, no blobs) instead of the full 200-entry log with data blobs |
| 3 | Scan throughput (GB/s) | Scan benchmark on a fixture tree | Size-prefilter → partial-hash → full-hash cascade + parallel walker (rayon already in tree) |
| 4 | Bundle weight / parse time | Build output sizes | Lazy-load whip/fun modules; dependency audit (`symphonia` formats, `image` formats) |

Known floors (do not chase): Tauri/WebView2 init, raw Windows API latency, the 320MB
exe (ffmpeg sidecar — documented trade in `docs/DELIVERY.md`).

## Execution order (approved)

1. **Perf harness + measurements first** (2–3 days) — everything else is guessing without it.
2. **Refactoring splits**, biggest-first, each behind green gates: `mock.ts` (2279 lines),
   `Makeover.tsx` (2083), `wallpaper_engine.rs` (1570), `security_center.rs` (1229),
   `ui.tsx` (1131). Zero behavior change per split; suite + E2E before and after.
3. **v1 owner gates** in parallel (publish draft → update-loop proof → smoke test).
4. **i18n slices** interleaved as filler (ratchet: 934 → 0, biggest files first).
5. **Product bets**, one at a time, each shippable alone — ALL FIVE approved:
   - Look rotator (scheduler UI over per-app looks)
   - Maintenance autopilot (one-tap weekly tidy with before/after report)
   - Pack diffing (manifest vs current state, pre-apply preview)
   - Widget gallery (shareable widget configs via pack machinery)
   - Risk score v2 (trend the D4 score from the undo log)

Rough shape: ~3–4 weeks at the demonstrated pace, shippable cut possible after every pillar.
