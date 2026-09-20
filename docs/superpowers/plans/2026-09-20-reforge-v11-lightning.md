# Reforge v1.1 Lightning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut user-felt latency 5-20x combined while splitting god-files and shipping 5 shippable-alone bets.

**Architecture:** Measure first, split biggest-first behind green gates with zero behavior change, build bets on the faster base; 8 file-disjoint lanes, 3 waves.

**Tech Stack:** Tauri 2 + Rust (windows 0.62, winreg, sysinfo) + React 19 + Vite 7 + Tailwind v4 + Vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-v11-design.md`

## Global Constraints

- Windows 10 & 11 only; per-user scope; WebView2 required.
- Unsigned permanently; keep "Unknown publisher" honesty copy.
- Local-first; no telemetry; no MSIX/cloud/boot-skinning/DLL-hacks.
- Every mutation logs undo entry BEFORE change; dry-run-first cleanup; staging trash.
- UI: live OS accent fallback #0067C0, 4px grid, radius 4/8/12, motion <=100ms + reduced-motion kill, flat skeleton pulse only.
- Rust returns typed Result<T,AppError>; frontend branches on kind via errorCopy().
- tsc clean, eslint 0 warnings, cargo clippy -D warnings, fmt --check, conventional commits.

---

### Task 1: Wave 0 perf re-baseline

**Files:**
- Modify: `docs/perf-baseline.json`
- Modify: `docs/perf-baseline.md`
- Run: `scripts/perf-run.mjs`, `scripts/perf-boot.mjs`, `scripts/perf-ipc.mjs`, `scripts/perf-scan.mjs`, `scripts/perf-bundle.mjs`

**Interfaces:**
- Consumes: existing scripts + prior baseline 2026-09-18 (boot 2ms deferred-slice, IPC 275 sites / 507x ratio, scan 0.77 GB/s, JS 958 KB).
- Produces: stamped `docs/perf-baseline.json { ts, boot.ms, ipc.roundTrips.totalRoundTripSites, ipc.payload.ratio, scan.gbPerSec, bundle.jsBytes }` that Tasks 2-8 regress against.

- [ ] **Step 1: Run the perf harness to re-stamp numbers**

Run: `node scripts/perf-run.mjs --scan-mb 120`
Expected: PASS, prints 4 metric blocks + writes `docs/perf-baseline.json`.

- [ ] **Step 2: Record headed cold-start caveat in perf-baseline.md**

Append a section to `docs/perf-baseline.md` noting whether `startup.log` was headed or headless and the exact machine/date, e.g.:

```markdown
## 2026-09-20 re-stamp (v1.1 Wave 0)

- Machine: <hostname>, headed: yes/no, date: 2026-09-20
- boot.ms=<n>, ipc.sites=275, ipc.ratio=<n>, scan.gbPerSec=<n>, jsBytes=<n>
- Caveat: deferred-slice != cold start; headed measurement required for <2s claim.
```

- [ ] **Step 3: Commit**

```bash
git add docs/perf-baseline.json docs/perf-baseline.md
git commit -m "chore: re-stamp perf baseline for v1.1 Wave 0"
```

### Task 2: IPC hot-path diet (digest + composite summary)

**Files:**
- Modify: `src-tauri/src/undo.rs` (add `get_undo_digest`)
- Modify: `src-tauri/src/dashboard.rs` (add `get_dashboard_summary`)
- Modify: `src-tauri/src/lib.rs` (register 2 commands)
- Modify: `src/lib/types.ts` (add `UndoDigest`, `DashboardSummary`)
- Modify: `src/views/History.tsx`, `src/views/Dashboard.tsx` (use digest/summary)
- Test: `src/lib/api.test.ts`, `src-tauri/src/undo.rs` (digest unit test)

**Interfaces:**
- Consumes: `UndoEntry { id, ts, kind, description, revertible, undone }`, existing `get_undo_log`, `get_dashboard_metrics`.
- Produces: `get_undo_digest() -> { total: number, byDay: Record<string,number>, byKind: Record<string,number> }`; `get_dashboard_summary() -> { health: number, personalization: number, storageFreedMb: number, undoTotal: number }`.

- [ ] **Step 1: Write failing frontend parity test for digest**

```ts
// in src/lib/api.test.ts append:
it("mock exposes get_undo_digest with counts only", async () => {
  const d: any = await (await import("./mock")).mockCall("get_undo_digest");
  expect(typeof d.total).toBe("number");
  expect(d.byDay).toBeDefined();
  expect(JSON.stringify(d).length).toBeLessThan(5000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api.test.ts -t "get_undo_digest"`
Expected: FAIL with "unknown command" or mock missing.

- [ ] **Step 3: Implement Rust digest + summary (minimal)**

```rust
#[tauri::command]
pub fn get_undo_digest(state: tauri::State<AppState>) -> Result<UndoDigest, AppError> {
    let log = load_undo_log(&state.data_dir)?;
    let mut by_day = std::collections::HashMap::new();
    let mut by_kind = std::collections::HashMap::new();
    for e in &log {
        *by_day.entry(e.ts[..10].to_string()).or_insert(0) += 1;
        *by_kind.entry(e.kind.clone()).or_insert(0) += 1;
    }
    Ok(UndoDigest { total: log.len(), by_day, by_kind })
}
```

Register both commands in `lib.rs` invoke_handler; add mock parity in `src/lib/mock.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/api.test.ts`
Expected: PASS. Run: `cargo test undo::` (MSVC env) Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/undo.rs src-tauri/src/dashboard.rs src-tauri/src/lib.rs src/lib/types.ts src/lib/mock.ts src/lib/api.test.ts src/views/History.tsx src/views/Dashboard.tsx
git commit -m "feat: add undo digest and dashboard summary to cut IPC bytes"
```

### Task 3: Frontend god-file splits (Makeover + Settings + ui)

**Files:**
- Modify: `src/views/Makeover.tsx` (extract 2 lazy sections first: engine + video)
- Create: `src/views/makeover/EngineSection.tsx`, `src/views/makeover/VideoSection.tsx`
- Modify: `src/views/Settings.tsx` (extract Automation section)
- Create: `src/views/settings/AutomationSection.tsx`
- Modify: `src/components/ui.tsx` (extract Toast)
- Create: `src/components/Toast.tsx`
- Test: `npm test` + `npm run test:e2e` (no new unit test; green gates are the test)

**Interfaces:**
- Consumes: existing hooks `useEngineSection`, `useVideoSection`, `ToastHost` props.
- Produces: identical rendered output, smaller entry chunks (`Makeover-*.js` down, `Settings-*.js` down).

- [ ] **Step 1: Verify green baseline before split**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/views/s10-views.test.tsx`
Expected: PASS (record commit hash as BASE).

- [ ] **Step 2: Extract EngineSection with lazy import**

```tsx
// src/views/makeover/EngineSection.tsx
export default function EngineSection(props: { ctx: unknown }) {
  return null; // moved verbatim from Makeover.tsx engine block
}
```

```tsx
// in Makeover.tsx
const EngineSection = lazy(() => import("./makeover/EngineSection"));
```

- [ ] **Step 3: Re-run gates to prove zero behavior change**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/views/s10-views.test.tsx src/views/s7-media.test.tsx`
Expected: PASS, no snapshot change except chunk names.

- [ ] **Step 4: Commit**

```bash
git add src/views/Makeover.tsx src/views/makeover/EngineSection.tsx src/views/makeover/VideoSection.tsx src/views/Settings.tsx src/views/settings/AutomationSection.tsx src/components/Toast.tsx src/components/ui.tsx
git commit -m "refactor: split Makeover/Settings/ui behind green gates"
```

### Task 4: Backend hardening (atomic writes + error finish + version_band)

**Files:**
- Modify: `src-tauri/src/storage.rs` (atomic save_json via tmp+rename)
- Modify: `src-tauri/src/error.rs` (add `io_err`, `registry_err` helpers)
- Modify: `src-tauri/src/capability.rs` (fix version_band order)
- Test: `src-tauri/src/storage.rs` (atomic write test), `src-tauri/src/capability.rs` (band test)

**Interfaces:**
- Consumes: `load_json/save_json`, `AppError::Io{path}`, `AppError::Registry{key}`.
- Produces: crash-safe writes; bands `26100->24H2` no longer shadowing `25999->25H2`.

- [ ] **Step 1: Write failing band-order test**

```rust
#[test]
fn version_band_25999_is_25h2_not_24h2() {
    assert_eq!(version_band(25999), "25H2");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test capability::version_band_25999`
Expected: FAIL (returns 24H2).

- [ ] **Step 3: Fix band order + atomic write + error helpers**

```rust
pub fn io_err(path: &str, e: std::io::Error) -> AppError {
    AppError::Io { path: path.into(), source: e }
}
```

```rust
// storage.rs save_json: write tmp then rename
let tmp = path.with_extension("tmp");
std::fs::write(&tmp, &bytes).map_err(|e| io_err(&path.display().to_string(), e))?;
std::fs::rename(&tmp, path).map_err(|e| io_err(&path.display().to_string(), e))?;
```

- [ ] **Step 4: Run tests**

Run: `cargo test storage:: capability::`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/storage.rs src-tauri/src/error.rs src-tauri/src/capability.rs
git commit -m "fix: atomic state writes, typed errors, version band order"
```

### Task 5: PR CI + E2E hardening

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `playwright.config.ts` (retries:1 on CI)
- Modify: `vitest.config.ts` (widen include toward src/**, keep 70% gate on existing 4 paths)
- Test: push to branch, observe Actions; local `npm run test:e2e`

**Interfaces:**
- Consumes: `scripts/test-ci.sh` 12 gates, `release.yml`, `pages.yml`.
- Produces: PR gate blocking merge on tsc+lint+vitest+parity+a11y+perf and windows cargo test + chromium E2E.

- [ ] **Step 1: Write ci.yml (ubuntu frontend + windows rust + e2e)**

```yaml
name: ci
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: bash scripts/test-ci.sh
  rust:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo fmt --check
      - run: cargo clippy --all-targets -- -D warnings
      - run: cargo test
  e2e:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run test:e2e
```

- [ ] **Step 2: Verify YAML + local fast gates**

Run: `npx tsc --noEmit && npm run lint && bash scripts/test-ci.sh`
Expected: PASS (startup-budget may skip in CI without log; acceptable).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml playwright.config.ts vitest.config.ts
git commit -m "ci: add PR gate for frontend, rust, and e2e"
```

### Task 6: i18n slice 1 + palette keyboard

**Files:**
- Modify: `src/i18n/en.json`, `src/i18n/es.json`, `src/i18n/de.json` (add `palette.help`, `palette.noResults` usage + Security 20 keys)
- Modify: `src/App.tsx` (wire Arrow/Enter in palette, use `t("palette.noResults")`)
- Modify: `src/views/Security.tsx` (replace 20 hardcoded strings with `t()`)
- Test: `src/views/s13-i18n.test.tsx`

**Interfaces:**
- Consumes: `useI18n() -> { lang, setLang, t }`, `I18nProvider`.
- Produces: palette keyboard navigable; hardcoded baseline drops by >=20.

- [ ] **Step 1: Write failing palette keyboard test**

```tsx
it("palette arrow+enter navigates", async () => {
  render(<App />);
  fireEvent.keyDown(document, { key: "ArrowDown" });
  expect(document.querySelector("[data-palette-active='true']")).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/views/s13-i18n.test.tsx`
Expected: FAIL (no active-descendant handling).

- [ ] **Step 3: Implement palette handlers + string extraction**

```tsx
onKeyDown={(e) => {
  if (e.key === "ArrowDown") setPaletteIdx((i) => Math.min(i + 1, items.length - 1));
  if (e.key === "ArrowUp") setPaletteIdx((i) => Math.max(i - 1, 0));
  if (e.key === "Enter") items[paletteIdx]?.run();
}}
```

Replace `No results for "{query}"` with `t("palette.noResults", { query })`.

- [ ] **Step 4: Verify ratchet drops**

Run: `node scripts/check-i18n-hardcoded.mjs && npx vitest run src/views/s13-i18n.test.tsx`
Expected: PASS, count < 934.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/en.json src/i18n/es.json src/i18n/de.json src/App.tsx src/views/Security.tsx src/views/s13-i18n.test.tsx
git commit -m "feat: palette keyboard nav and Security i18n slice"
```

### Task 7: UX/IA fixes (rename collision + sidebar + status bar)

**Files:**
- Modify: `src/App.tsx` (nav labels: "Style Studio" vs "Makeover session"; collapsible sidebar; status bar for scan/transcode progress)
- Modify: `src/index.css` (sidebar collapsed token, status bar)
- Test: `src/views/s10-views.test.tsx`, `e2e/journeys.spec.ts` (palette nav journey)

**Interfaces:**
- Consumes: `View` ids `styles`/`makeover`, `onEvent("scan-progress")`, `onEvent("transcode-progress")`.
- Produces: unambiguous nav; `data-sidebar="collapsed"`; `data-testid="status-bar"` showing active job + percent.

- [ ] **Step 1: Write failing status-bar test**

```tsx
it("shows scan progress in status bar", async () => {
  render(<App />);
  fireEvent(window, new CustomEvent("reforge:test-scan-progress", { detail: { scanned: 1, total: 2 } }));
  expect(await screen.findByTestId("status-bar")).toHaveTextContent(/1.*2|50%/);
});
```

- [ ] **Step 2: Implement nav rename + status bar subscriber**

```tsx
// nav labels:
{ id: "styles", label: t("nav.styleStudio") /* "Style Studio" */ },
{ id: "makeover", label: t("nav.makeoverSession") /* "Makeover session" */ },
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/views/s10-views.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/index.css src/views/s10-views.test.tsx
git commit -m "feat: disambiguate Studio vs Session nav, add job status bar"
```

### Task 8: Product bets batch 1 (Look rotator + Maintenance autopilot)

**Files:**
- Modify: `src-tauri/src/applooks.rs` (rotator: schedule look per app/focus)
- Modify: `src-tauri/src/maintenance.rs` (autopilot report with before/after bytes)
- Modify: `src/views/Productivity.tsx` (rotator UI), `src/views/Tuneup.tsx` (autopilot card + report)
- Modify: `src/lib/types.ts`, `src/lib/mock.ts` (new commands)
- Test: `e2e/journeys.spec.ts` (1 new journey: autopilot weekly tidy produces report)

**Interfaces:**
- Consumes: Tasks 2+4 (digest, atomic writes), `spawn_app_look_watcher`, `run_maintenance`.
- Produces: `schedule_look { app, lookId, cron }`, `run_autopilot() -> { cleanedMb, dupesRemoved, reportId }`, each with undo entries.

- [ ] **Step 1: Write failing autopilot report test**

```ts
it("autopilot returns before/after report", async () => {
  const r: any = await mockCall("run_autopilot");
  expect(r.cleanedMb).toBeGreaterThanOrEqual(0);
  expect(r.reportId).toBeTruthy();
});
```

- [ ] **Step 2: Implement Rust autopilot + rotator schedule (minimal, reversible)**

```rust
#[tauri::command]
pub fn run_autopilot(state: tauri::State<AppState>) -> Result<AutopilotReport, AppError> {
    let before = scan_storage_radar(state.clone())?;
    let cleaned = run_maintenance(state.clone())?;
    Ok(AutopilotReport { cleaned_mb: cleaned.cleaned_mb, report_id: uuid::Uuid::new_v4().to_string() })
}
```

Every mutation inside must call `undo::log_entry` BEFORE changing anything.

- [ ] **Step 3: Run gates**

Run: `npx vitest run src/lib/api.test.ts && npm run lint && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/applooks.rs src-tauri/src/maintenance.rs src/views/Productivity.tsx src/views/Tuneup.tsx src/lib/types.ts src/lib/mock.ts
git commit -m "feat: look rotator schedule and maintenance autopilot with report"
```
