# Reforge Big Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one substantial Reforge update that is sleek, premium, and playful end-to-end (discover → preview → apply → undo) while closing the audited v1.0 gaps underneath: pending security fixes, i18n extraction, E2E proof, analytics depth, power-user surface, perf/security passes, and a proven release.

**Architecture:** Work journey-by-journey on top of the existing Tauri 2 + React architecture: stabilize the dirty baseline first, then alternate one user-visible improvement with its tests and commit, keeping every task independently shippable so any single task can be rejected without losing the rest. All motion is original CSS/React — never copy ReactBits source (MIT + Commons Clause redistribution ambiguity vs GPL-3.0).

**Tech Stack:** Tauri 2 + Rust + React 19 + TypeScript ~5.8.3 + Tailwind CSS v4 + Vitest + Playwright (`@playwright/test` ^1.63.0, Chromium project, mock backend, baseURL `http://127.0.0.1:1425`).

**Spec:** `docs/ROADMAP.md` (Part C phases S/M/P/X + Part E quality gates; `docs/DELIVERY.md` records P-1/P-2/MSIX/X-5 outcomes).

## Global Constraints

- Windows-only app (Windows 10 & 11); Rust backend compiles for Windows targets only.
- Git: conventional prefixes, atomic commits; small scoped commits, one logical change per commit.
- Quality gates every task: `npx tsc --noEmit` clean · `npm run lint` clean (0 warnings) · `npm test` green · `npm run test:a11y` green · `cargo fmt --check` clean · `cargo clippy --all-targets -- -D warnings` clean · `cargo test` green (run cargo from an MSVC developer prompt).
- Every new Rust command: typed `Result<T, AppError>`, no `unwrap()`/`expect()` in production code, inputs validated Rust-side, undo entry written BEFORE mutation.
- Every new UI: loading / empty / error / populated states; keyboard-operable; light + dark + OS accent; reduced-motion honored.
- Mock parity grows with every new command (`node scripts/check-arg-parity.mjs`, `node scripts/check-kind-parity.mjs`).
- i18n: every UI string goes to `en.json` + `es.json` + `de.json` together; `node scripts/check-i18n-hardcoded.mjs` must not rise above BASELINE (lower it on each extraction slice).
- Startup handoff within budget (`scripts/check-startup-budget.sh`).
- Release work: fresh-install smoke + update-loop proof; publishing is an owner-gated manual step.

---

## File structure

- `src-tauri/src/capability.rs`, `src-tauri/src/network.rs` — pending X-9 validation edits (already in working tree; stabilize first).
- `src/views/Power.tsx`, `src/views/s10-views.test.tsx`, `src/i18n/{en,es,de}.json`, `scripts/check-i18n-hardcoded.mjs` — i18n extraction slices.
- `package.json`, `e2e/journeys.spec.ts`, `e2e/fixtures.ts`, `playwright.config.ts` — E2E proof (10 journeys already written; verify green, add `test:e2e` script).
- `src/views/Marketplace.tsx`, `src/views/MakeoverSession.tsx`, `src/views/Makeover.tsx`, `src/views/History.tsx`, `src/views/Organize.tsx`, `src/features/widgets/hub.tsx`, `src/index.css`, `src/components/ui.tsx` — journey-led motion deepening (original code only).
- `src/lib/trends.ts`, `src/lib/trends.test.ts`, `src/views/Dashboard.tsx` — analytics depth.
- `src-tauri/src/lib.rs`, `src-tauri/src/system.rs`, `src/lib/types.ts`, `src/lib/mock.ts`, `src/views/Settings.tsx` — power-user surface (`--help`, `list_config_files` already registered; add read-only registry view).
- `docs/DELIVERY.md`, `docs/ROADMAP.md`, `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` — audit record + release.
- `src-tauri/src/duplicates.rs`, `src/views/Organize.tsx`, `src/views/Dashboard.tsx`, `src/lib/risk.ts` — backlog P1s (auto-resolution, risk score).
- `src-tauri/src/applooks.rs`, `src-tauri/src/contextmenu.rs`, `src-tauri/src/lib.rs` — per-app looks + right-click themer.
- `src/components/motion/*.tsx`, `src/components/motion/*.test.tsx` — original signature motion set.
- `src/views/History.tsx`, `scripts/check-startup-budget.sh` — release hardening (away-log, budget).

---

### Task 0: Stabilize the dirty baseline (pending X-9 validation)

**Files:**
- Modify: `src-tauri/src/capability.rs` (already modified: `ps_single_quote` + test)
- Modify: `src-tauri/src/network.rs` (already modified: `validate_profile_name` + tests + VPN call sites)
- Test: existing `cargo test` suites (`validation_tests`, `ps_single_quote_doubles_quotes`)

**Interfaces:**
- Consumes: dirty working tree (`git status --short` shows the two files).
- Produces: clean tree, verified Rust baseline for every later task.

**Done when:** `git status --short` is empty and the full Rust gate is green; two commits exist (one per file).

- [ ] **Step 1: Inspect the pending diff**

```bash
git status --short
git diff --check
git diff --stat -- src-tauri/src/capability.rs src-tauri/src/network.rs
```

Expected: only the two files modified; zero whitespace errors.

- [ ] **Step 2: Run the Rust gate (MSVC prompt)**

```bash
call "Z:\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
cd /d Z:\Projects\reforge\src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --lib validation_tests
cargo test --lib ps_single_quote_doubles_quotes
```

Expected: all green (fmt clean, zero clippy warnings, new validation tests pass).

- [ ] **Step 3: Run the full Rust suite**

```bash
cargo test
```

Expected: PASS, 0 failed (baseline was 133 passed / 0 failed on 2026-09-18).

- [ ] **Step 4: Commit capability fix alone**

```bash
git add -- src-tauri/src/capability.rs
git commit -m "fix: escape single quotes in elevation PowerShell path"
```

- [ ] **Step 5: Commit network fix alone**

```bash
git add -- src-tauri/src/network.rs
git commit -m "fix: validate VPN profile names before rasdial"
```

---

### Task 1: i18n extraction slice — Power view (19 strings)

**Files:**
- Modify: `src/views/Power.tsx:1-163` (import `useI18n`, replace literals with `t("power.*")`)
- Modify: `src/i18n/en.json`, `src/i18n/es.json`, `src/i18n/de.json` (add `power.*` keys)
- Modify: `scripts/check-i18n-hardcoded.mjs:18` (lower `BASELINE` to the new measured total)
- Test: `src/views/s10-views.test.tsx:19-34` (unchanged English assertions — default context falls back to `en`)

**Interfaces:**
- Consumes: `useI18n()` from `src/i18n/index.tsx` (`t(key, vars?)`, fallback en → key).
- Produces: `power.*` keys in three locales; lower hardcoded-string count.

**Done when:** `s10-views` passes, parity tests pass, guard total drops and BASELINE is updated to match.

- [ ] **Step 1: Add the keys to all three catalogs**

```json
"power.title": "Power & battery",
"power.subtitle": "Plan, screen-off timers and battery health — every change reversible from History",
"power.battery": "Battery",
"power.battery.subtitle": "Live from the system",
"power.chargingAC": "Charging · on AC",
"power.onAC": "On AC",
"power.charging": "Charging",
"power.onBattery": "On battery",
"power.health": "Health (design vs full)",
"power.cycles": "Cycle count",
"power.fullCapacity": "Full capacity",
"power.plan": "Power plan",
"power.plan.subtitle": "What Windows prioritizes",
"power.screenOff": "Screen-off timer",
"power.screenOff.subtitle": "When the display sleeps while you're away",
"power.onPower": "On power (minutes)",
"power.onBattery": "On battery (minutes)",
"power.apply": "Apply",
"power.hibernate": "Hibernate",
"power.hibernate.subtitle": "Save RAM to disk for a fast resume",
"power.hibernate.unavailable": "Not available on this system",
"power.hibernate.desc": "Writes RAM to disk — uses a hibernation file",
"power.hibernate.admin": "Toggling needs administrator rights.",
"power.noBattery": "No battery detected — desktop power settings still apply.",
"power.planChanged": "Power plan changed"
```

```json
"power.title": "Energía y batería",
"power.subtitle": "Plan, temporizadores de apagado y salud de la batería — todo reversible desde el Historial",
"power.battery": "Batería",
"power.battery.subtitle": "En vivo desde el sistema",
"power.chargingAC": "Cargando · con CA",
"power.onAC": "Con CA",
"power.charging": "Cargando",
"power.onBattery": "Con batería",
"power.health": "Salud (diseño vs real)",
"power.cycles": "Ciclos",
"power.fullCapacity": "Capacidad total",
"power.plan": "Plan de energía",
"power.plan.subtitle": "Lo que Windows prioriza",
"power.screenOff": "Apagado de pantalla",
"power.screenOff.subtitle": "Cuándo duerme la pantalla en tu ausencia",
"power.onPower": "Con corriente (minutos)",
"power.onBattery": "Con batería (minutos)",
"power.apply": "Aplicar",
"power.hibernate": "Hibernar",
"power.hibernate.subtitle": "Guarda la RAM en disco para reanudar rápido",
"power.hibernate.unavailable": "No disponible en este sistema",
"power.hibernate.desc": "Escribe la RAM en disco — usa un archivo de hibernación",
"power.hibernate.admin": "Cambiarlo requiere derechos de administrador.",
"power.noBattery": "Sin batería detectada — los ajustes de energía de escritorio siguen aplicando.",
"power.planChanged": "Plan de energía cambiado"
```

```json
"power.title": "Energie & Akku",
"power.subtitle": "Plan, Bildschirm-Timeouts und Akkugesundheit — jede Änderung aus dem Verlauf reversibel",
"power.battery": "Akku",
"power.battery.subtitle": "Live vom System",
"power.chargingAC": "Lädt · am Netz",
"power.onAC": "Am Netz",
"power.charging": "Lädt",
"power.onBattery": "Akkubetrieb",
"power.health": "Gesundheit (Design vs. voll)",
"power.cycles": "Zyklen",
"power.fullCapacity": "Vollkapazität",
"power.plan": "Energiesparplan",
"power.plan.subtitle": "Worauf Windows Wert legt",
"power.screenOff": "Bildschirm-Timeout",
"power.screenOff.subtitle": "Wann der Bildschirm in Abwesenheit schläft",
"power.onPower": "Am Netz (Minuten)",
"power.onBattery": "Akku (Minuten)",
"power.apply": "Anwenden",
"power.hibernate": "Ruhezustand",
"power.hibernate.subtitle": "Speichert RAM auf Disk für schnelles Fortsetzen",
"power.hibernate.unavailable": "Auf diesem System nicht verfügbar",
"power.hibernate.desc": "Schreibt RAM auf Disk — nutzt eine Ruhezustandsdatei",
"power.hibernate.admin": "Umschalten braucht Administratorrechte.",
"power.noBattery": "Kein Akku erkannt — Desktop-Energieeinstellungen gelten trotzdem.",
"power.planChanged": "Energiesparplan geändert"
```

Backend plan names/hints (`p.name`, `p.hint`) are app data and stay untranslated per `settings.language.desc`.

- [ ] **Step 2: Rewire the component**

```tsx
import { useI18n } from "../i18n";

export default function Power() {
  const { t } = useI18n();
  // ...
  .then(() => { toast(t("power.planChanged")); refresh(); })
  // <h1 className="page-title">{t("power.title")}</h1>
  // <p className="page-subtitle">{t("power.subtitle")}</p>
  // Section title={t("power.battery")} subtitle={t("power.battery.subtitle")}
  // {battery.on_ac ? (battery.charging ? t("power.chargingAC") : t("power.onAC")) : battery.charging ? t("power.charging") : t("power.onBattery")}
  // ...same pattern for health/cycles/fullCapacity/plan/screenOff/hibernate/noBattery
```

- [ ] **Step 3: Run the affected tests**

```bash
npm test -- src/views/s10-views.test.tsx src/views/s13-i18n.test.tsx
npx tsc --noEmit
npm run lint
```

Expected: PASS (English assertions hold via the default-context en fallback; parity tests cover the new keys automatically).

- [ ] **Step 4: Measure and lower the ratchet**

```bash
node scripts/check-i18n-hardcoded.mjs
```

Expected: total below 954. Set `const BASELINE` in `scripts/check-i18n-hardcoded.mjs:18` to the new measured total.

- [ ] **Step 5: Commit**

```bash
git add -- src/views/Power.tsx src/i18n/en.json src/i18n/es.json src/i18n/de.json scripts/check-i18n-hardcoded.mjs
git commit -m "feat: extract Power view to en/es/de catalogs"
```

---

### Task 2: Prove the E2E gate (10 journeys already written)

**Files:**
- Modify: `package.json:6-17` (add `"test:e2e": "playwright test"`)
- Modify: `e2e/journeys.spec.ts` only if a journey fails (fix the test or the app, never weaken the assertion)
- Test: `e2e/journeys.spec.ts` (10 tests: duplicates, makeover, junk, pack apply, share-code, update, security scan, settings persistence, palette, factory fresh)

**Interfaces:**
- Consumes: `e2e/fixtures.ts` (`openApp`, `navigate`, `state`, `revertHistory`, `packCard`), mock backend on `http://127.0.0.1:1425`.
- Produces: a repeatable one-command E2E gate.

**Done when:** `npm run test:e2e` passes 10/10 twice in a row (flake check).

- [ ] **Step 1: Install the browser once**

```bash
npx playwright install chromium
```

- [ ] **Step 2: Add the script**

```json
"test:e2e": "playwright test",
```

- [ ] **Step 3: Run the full gate**

```bash
npm run test:e2e
```

Expected: `10 passed`. If a journey fails, reproduce it with `npx playwright test e2e/journeys.spec.ts -g "<test name>"`, fix the app code (preferred) or the selector, and re-run the whole file — never delete or soften an assertion to go green.

- [ ] **Step 4: Re-run for flakes**

```bash
npm run test:e2e
```

Expected: `10 passed` again.

- [ ] **Step 5: Commit**

```bash
git add -- package.json package-lock.json e2e/journeys.spec.ts
git commit -m "test: prove top-10 browser journeys green with test:e2e script"
```

---

### Task 3: Makeover motion deepening (stepper, magnetic CTA, completion reveal)

**Files:**
- Modify: `src/views/MakeoverSession.tsx` (step transitions + staggered summary cards; existing badge animation stays)
- Modify: `src/views/Makeover.tsx` (quiz question fade + completion text reveal)
- Modify: `src/views/Dashboard.tsx` (magnetic "Start makeover" nudge — already a 1px hover; deepen to a cursor-follow within 120px, disabled on touch/reduced-motion)
- Modify: `src/index.css` (keyframes: `stepIn`, `riseIn`, `magnetReset`; all inside `@media (prefers-reduced-motion: no-preference)`)
- Test: extend `src/views/s13-a11y.test.tsx` (new motion honors reduced-motion; stepper keeps `aria-current="step"`)

**Interfaces:**
- Consumes: existing `.animate-*` tokens in `src/index.css`, `aria-live="polite"` regions.
- Produces: original motion primitives other views reuse in Task 4.

**Done when:** stepperฺ announces steps, CTA never moves the click target more than 2px, `npm run test:a11y` green.

- [ ] **Step 1: Write the failing motion test**

```tsx
it("makeover stepper exposes the current step and freezes under reduced motion", async () => {
  stubReduced(true);
  render(<MakeoverSession />);
  expect(screen.getByRole("tablist", { name: /makeover steps/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { selected: true })).toBeInTheDocument();
});
```

Run: `npm test -- src/views/s13-a11y.test.tsx`. Expected: FAIL (no tablist semantics yet).

- [ ] **Step 2: Implement minimal semantics + motion**

```tsx
<div role="tablist" aria-label="Makeover steps">
  {steps.map((s) => (
    <button role="tab" aria-selected={s.id === step} aria-current={s.id === step ? "step" : undefined} className={s.id === step ? "animate-step-in" : undefined}>
```

```css
@media (prefers-reduced-motion: no-preference) {
  .animate-step-in { animation: stepIn 140ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes stepIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
}
```

- [ ] **Step 3: Verify**

```bash
npm test -- src/views/s13-a11y.test.tsx
npx tsc --noEmit
npm run lint
npm run test:a11y
```

- [ ] **Step 4: Visually verify once** (`npm run dev`, keyboard through the wizard with reduced-motion on and off).

- [ ] **Step 5: Commit**

```bash
git add -- src/views/MakeoverSession.tsx src/views/Makeover.tsx src/views/Dashboard.tsx src/index.css src/views/s13-a11y.test.tsx
git commit -m "feat: deepen makeover motion with stepper semantics and reveal"
```

---

### Task 4: History, Organize, Widgets motion (fixed keyboard, folder previews, dock)

**Files:**
- Modify: `src/views/History.tsx` (entry enter-animation; list keeps `role="list"`/`listitem`)
- Modify: `src/views/Organize.tsx` (smart-folder rows disclose previews inline; existing Run-button affordance stays)
- Modify: `src/features/widgets/hub.tsx` (dock magnification on fine pointers only; trigger buttons keep labels)
- Modify: `src/index.css` (shared `riseIn`, `popIn` keyframes)
- Test: extend `src/views/s2-empty-states.test.tsx` (animated-list keyboard: arrows move, Enter activates, focus never leaves the list)

**Interfaces:**
- Consumes: Task 3 motion tokens; existing `aria-live` regions.
- Produces: reusable list-motion pattern; no global key handlers (AnimatedList-style global arrow trapping is banned — scope keys to the list element).

**Done when:** keyboard test green, no pointer-only affordance, `test:a11y` green.

- [ ] **Step 1: Write the failing keyboard test**

```tsx
it("history rows navigate with arrows and activate with Enter", async () => {
  render(<History />);
  const list = await screen.findByRole("list", { name: /changes/i });
  list.focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(document.activeElement?.getAttribute("role")).toBe("listitem");
  await userEvent.keyboard("{Enter}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
```

Run: `npm test -- src/views/s2-empty-states.test.tsx`. Expected: FAIL (rows are not focusable listitems yet).

- [ ] **Step 2: Implement scoped roving focus**

```tsx
<div role="list" aria-label="Changes" onKeyDown={(e) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
  e.stopPropagation(); // never trap global keys
  // move focus among [role="listitem"] children; Enter clicks the focused row's primary action
}}>
```

- [ ] **Step 3: Verify**

```bash
npm test -- src/views/s2-empty-states.test.tsx
npx tsc --noEmit
npm run lint
npm run test:a11y
```

- [ ] **Step 4: Visually verify once** (History, Organize smart folders, Widgets dock; touch + reduced-motion).

- [ ] **Step 5: Commit**

```bash
git add -- src/views/History.tsx src/views/Organize.tsx src/features/widgets/hub.tsx src/index.css src/views/s2-empty-states.test.tsx
git commit -m "feat: scoped keyboard motion for history, folders and widget dock"
```

---

### Task 5: Analytics depth (monthly trends from local data)

**Files:**
- Modify: `src/lib/trends.ts` (add `bucketByMonth(entries, months, nowSecs?)` next to `bucketByDay`)
- Modify: `src/lib/trends.test.ts` (monthly bucketing + empty-log cases)
- Modify: `src/views/Dashboard.tsx:44,247-250` (add a 6-month bar strip reusing `trendBuckets` pattern; strings via `analytics.*` keys)

**Interfaces:**
- Consumes: `UndoEntry.ts` from `get_undo_log` (already loaded as `recent`); `bucketByDay` signature as the template.
- Produces: `DayBucket[]`-shaped monthly data the Dashboard renders with zero new collection.

**Done when:** unit tests green, Dashboard shows 14-day + 6-month strips from the same local log.

- [ ] **Step 1: Write the failing test**

```ts
import { bucketByMonth } from "./trends";

it("buckets entries per calendar month", () => {
  const now = new Date(2026, 8, 18).getTime() / 1000;
  const entries = [{ ts: now - 10 }, { ts: now - 40 * 86400 }, { ts: now - 200 * 86400 }];
  const buckets = bucketByMonth(entries, 6, now);
  expect(buckets).toHaveLength(6);
  expect(buckets[5].count).toBe(1);
  expect(buckets.reduce((a, b) => a + b.count, 0)).toBe(2);
});
```

Run: `npm test -- src/lib/trends.test.ts`. Expected: FAIL (`bucketByMonth` undefined).

- [ ] **Step 2: Implement**

```ts
export function bucketByMonth(entries: { ts: number }[], months = 6, nowSecs?: number): DayBucket[] {
  const now = new Date((nowSecs ?? Date.now() / 1000) * 1000);
  const out: DayBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime() / 1000;
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime() / 1000;
    out.push({
      label: new Date(start * 1000).toLocaleString("en-US", { month: "short" }),
      count: entries.filter((e) => e.ts >= start && e.ts < end).length,
    });
  }
  return out;
}
```

- [ ] **Step 3: Render the strip in Dashboard** (copy the 14-day `trendBuckets` block; memoize `bucketByMonth(recent ?? [], 6)`). Include a one-line "while you were away" summary under the strips: newest undo entry description + `fmtAge(ts)` (covers X-4's event-log story from the same local log).

- [ ] **Step 4: Verify**

```bash
npm test -- src/lib/trends.test.ts
npx tsc --noEmit
npm run lint
node scripts/check-i18n-hardcoded.mjs
```

Expected: tests green; hardcoded count unchanged (new copy goes straight to `analytics.*` keys).

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/trends.ts src/lib/trends.test.ts src/views/Dashboard.tsx src/i18n/en.json src/i18n/es.json src/i18n/de.json
git commit -m "feat: monthly activity trends from local history"
```

---

### Task 6: Power-user completion (read-only registry view)

**Files:**
- Modify: `src-tauri/src/system.rs` (new `RegistryValue` struct + `read_registry_value` command with a fixed allowlist; no arbitrary paths)
- Modify: `src-tauri/src/lib.rs` (register `system::read_registry_value`)
- Modify: `src/lib/types.ts` (add `RegistryValue { path, name, value, kind }`)
- Modify: `src/lib/mock.ts` (add `case "read_registry_value":` returning canned values for the allowlisted keys)
- Modify: `src/views/Settings.tsx` (Advanced section: registry table behind the existing settings toggle pattern)
- Test: Rust unit tests for allowlist rejection; `src/views/s12-delivery.test.tsx`-style render test for the table

**Interfaces:**
- Consumes: `State<'_, AppState>` (unused, for handler shape); `validate pattern` from Task 0 (`validate_profile_name`).
- Produces: `RegistryValue[]`; frontend table.

**Done when:** arbitrary paths rejected by test, allowlisted keys render, parity scripts green.

- [ ] **Step 1: Write the failing Rust test**

```rust
#[test]
fn registry_view_rejects_arbitrary_paths() {
    assert!(read_registry_value_in(r"HKLM\SOFTWARE\Evil", "x").is_err());
    assert!(read_registry_value_in(r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme").is_ok());
}
```

Run: `cargo test registry_view_rejects_arbitrary_paths` (MSVC prompt). Expected: FAIL (function missing).

- [ ] **Step 2: Implement (allowlist only)**

```rust
const REGISTRY_ALLOWLIST: &[(&str, &str)] = &[
    (r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme"),
    (r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "ColorPrevalence"),
    (r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "TaskbarAl"),
    (r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "TaskbarSi"),
];

fn read_registry_value_in(path: &str, name: &str) -> Result<RegistryValue, AppError> {
    if !REGISTRY_ALLOWLIST.contains(&(path, name)) {
        return Err(AppError::Invalid("Registry path is not in the read-only allowlist.".into()));
    }
    // ... read via winreg, map to RegistryValue { path, name, value, kind }
}

#[tauri::command]
pub fn read_registry_value(path: String, name: String) -> Result<RegistryValue, AppError> {
    read_registry_value_in(path.trim(), name.trim())
}
```

- [ ] **Step 3: Wire handler + types + mock + UI** (register in `lib.rs` invoke_handler; add `RegistryValue` to `types.ts`; mock case returns the four allowlisted values; Settings Advanced table with loading/error states).

- [ ] **Step 4: Verify**

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test registry_view
node scripts/check-arg-parity.mjs
node scripts/check-kind-parity.mjs
npm test -- src/views/s12-delivery.test.tsx
npx tsc --noEmit
npm run lint
npm run test:a11y
```

- [ ] **Step 5: Commit (two commits: Rust, then frontend)**

```bash
git add -- src-tauri/src/system.rs src-tauri/src/lib.rs
git commit -m "feat: allowlisted read-only registry values with rejection tests"
git add -- src/lib/types.ts src/lib/mock.ts src/views/Settings.tsx src/i18n/en.json src/i18n/es.json src/i18n/de.json
git commit -m "feat: Advanced settings registry table (read-only)"
```

---

### Task 7: Perf + security final pass (measured, dated)

**Files:**
- Modify: `docs/DELIVERY.md` (append dated X-8/X-9 audit note)
- Modify: `scripts/check-startup-budget.sh` only if the measured budget changes (otherwise leave it)
- Test: existing gates (no new code unless the profiler indicts something)

**Interfaces:**
- Consumes: `startup.log` handoff measurement, unwrap/shell sweep commands below.
- Produces: a dated audit record; zero silent scope growth.

**Done when:** DELIVERY records fresh numbers and every sweep below is clean.

- [ ] **Step 1: Re-run the unwrap sweep (production code only)**

```bash
"C:\Program Files\Git\bin\bash.exe" -c "grep -rn '\.unwrap()\|\.expect(' src-tauri/src --include='*.rs' | grep -v 'cfg(test)' | grep -v 'mod tests'"
```

Expected: only constant parses (`"127.0.0.1:6742".parse().unwrap()`), process-entry `.expect()` in `run()`/`run_screensaver_app()`, and the `about:blank` fallback — each with a justifying comment. Any new hit gets a fix + test, not a shrug.

- [ ] **Step 2: Re-run the shell sweep**

```bash
"C:\Program Files\Git\bin\bash.exe" -c "grep -rn 'Command::new\|powershell\|netsh\|rasdial' src-tauri/src --include='*.rs' | grep -v 'cfg(test)'"
```

Expected: every PowerShell script is a fixed constant; every user-influenced arg passes through `validate_profile_name`, `validate_threat_id`, or `ps_single_quote` and travels as one argv element.

- [ ] **Step 3: Measure startup**

```bash
bash scripts/check-startup-budget.sh
```

Record the measured handoff time in DELIVERY.md. Tighten the budget only if the measurement supports it with headroom.

- [ ] **Step 4: Record the audit**

```markdown
## 2026-09-__ security + perf re-verification (X-8/X-9)
- unwrap sweep: <clean / findings + commits>
- shell sweep: <clean / findings + commits>
- startup handoff: <measured>ms (budget <current>ms)
- pack importer: extension + content-sniff + size caps verified in `marketplace.rs:validate_pack_security`
```

- [ ] **Step 5: Commit**

```bash
git add -- docs/DELIVERY.md scripts/check-startup-budget.sh
git commit -m "docs: record dated X-8/X-9 verification with measurements"
```

---

### Task 8: Release proof + version 1.0 (owner-gated steps marked)

**Files:**
- Modify: `package.json:4`, `src-tauri/tauri.conf.json:4`, `src-tauri/Cargo.toml` (`version = "0.1.0"` → `"1.0.0"`)
- Modify: `README.md` (status flip), `docs/ROADMAP.md` (v1.0 shipped note), new `CHANGELOG.md` entry
- Test: release workflow dry-run only; live steps are manual gates below

**Interfaces:**
- Consumes: green gates from Tasks 0–7.
- Produces: `v1.0.0` tag; draft release artifacts.

**Done when:** ROADMAP S-1..S-5 boxes are honestly checked (owner gates explicitly signed off).

- [ ] **Step 1: Bump versions (automatable)**

```bash
npm pkg set version=1.0.0
```

Then edit `src-tauri/tauri.conf.json` (`"version": "0.1.0"` → `"1.0.0"`) and `src-tauri/Cargo.toml` (`version = "0.1.0"` → `"1.0.0"`), rebuild frontend (`npm run build`) so `dist/` matches.

- [ ] **Step 2: Write the changelog entry** (`CHANGELOG.md`: highlights, reversibility note, unsigned-by-decision honesty).

- [ ] **Step 3: Tag (triggers `.github/workflows/release.yml`)**

```bash
git add -- package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml README.md docs/ROADMAP.md CHANGELOG.md
git commit -m "chore: bump to 1.0.0 for release"
git tag v1.0.0
git push origin main v1.0.0
```

- [ ] **Step 4 (OWNER GATE): publish + prove the loop** — publish the draft release; bump a test version and confirm in-app check → download → sha256 → silent NSIS install on a test machine (ROADMAP S-3); fresh-install smoke on a clean account (S-5).

- [ ] **Step 5: Record outcomes** — check off S-1..S-5 in ROADMAP with dates; commit:

```bash
git add -- docs/ROADMAP.md docs/DELIVERY.md
git commit -m "docs: record v1.0.0 release proof"
git push origin main
```

---

---

### Task 9: Backlog P1s — duplicate auto-resolution + Risk score (ROADMAP D2/D4)

**Files:**
- Modify: `src-tauri/src/duplicates.rs` (new `ResolveRule` + `pick_removals` pure fn + `resolve_duplicate_group` command)
- Modify: `src-tauri/src/lib.rs` (register `duplicates::resolve_duplicate_group`)
- Modify: `src/views/Organize.tsx` (rule picker + "Auto-resolve" feeding existing `remove_duplicates`)
- Create: `src/lib/risk.ts`, `src/lib/risk.test.ts` (pure `riskScore(health, autorunFlags, defender)` 0–100)
- Modify: `src/views/Dashboard.tsx` (Risk score card from `get_health_score` + `security_audit_autorun_threat_surface` + `security_get_digest`)
- Test: Rust temp-dir tests; `risk.test.ts`; Organize E2E addition optional

**Interfaces:**
- Consumes: `DuplicateGroup { id, name, size, files: [{ path, modified }] }`; existing `remove_duplicates(paths)` (trash + undo unchanged).
- Produces: `Vec<String>` paths-to-remove per group+rule; `riskScore(...) → { score, level }`.

**Done when:** one-click auto-resolve moves exactly the non-survivors to staging trash (undoable); Dashboard shows a Risk number consistent with its three inputs.

- [ ] **Step 1: Write the failing Rust test**

```rust
#[test]
fn keep_newest_removes_all_but_latest() {
    let dir = tempdir().unwrap();
    let a = write_file(&dir, "a.txt", "old");
    fn group() -> DuplicateGroup {
        DuplicateGroup { id: "g".into(), name: "t".into(), size: 0, files: vec![
            DuplicateFile { path: r"C:\a\old.txt".into(), modified: 1000 },
            DuplicateFile { path: r"C:\b\new.txt".into(), modified: 2000 },
        ] }
    }
    let remove = pick_removals(&group(), &ResolveRule::Newest).unwrap();
    assert_eq!(remove, vec![r"C:\a\old.txt".to_string()]);
}
```

Run: `cargo test keep_newest` (MSVC prompt). Expected: FAIL (`pick_removals` missing).

- [ ] **Step 2: Implement the resolver**

```rust
#[derive(Deserialize, Clone)]
pub enum ResolveRule { Newest, Oldest, InFolder { folder: String } }

pub fn pick_removals(group: &DuplicateGroup, rule: &ResolveRule) -> Result<Vec<String>, AppError> {
    if group.files.len() < 2 { return Ok(vec![]); }
    let survivor = match rule {
        ResolveRule::Newest => group.files.iter().max_by_key(|f| f.modified),
        ResolveRule::Oldest => group.files.iter().min_by_key(|f| f.modified),
        ResolveRule::InFolder { folder } => group.files.iter().find(|f| f.path.starts_with(folder.as_str())),
    }.ok_or_else(|| AppError::Invalid("No survivor matched the rule.".into()))?;
    Ok(group.files.iter().filter(|f| f.path != survivor.path).map(|f| f.path.clone()).collect())
}

#[tauri::command]
pub fn resolve_duplicate_group(group: DuplicateGroup, rule: ResolveRule) -> Result<Vec<String>, AppError> {
    pick_removals(&group, &rule)
}
```

Rule semantics: survivor stays, everything else goes to existing `remove_duplicates` (staging trash, one undo entry). `InFolder` falls back to error — never silently picks. (Variant names are prefix-free per clippy `enum-variant-names`; `DuplicateGroup`/`DuplicateFile` gain `Deserialize` for the command boundary.)

- [ ] **Step 3: Write the failing risk test**

```ts
import { riskScore } from "./risk";

it("scores a clean machine high and a risky one low", () => {
  expect(riskScore({ startup: 2, autorunFlags: 0, defenderOn: true }).score).toBeGreaterThan(80);
  expect(riskScore({ startup: 14, autorunFlags: 5, defenderOn: false }).score).toBeLessThan(40);
});
```

Run: `npm test -- src/lib/risk.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 4: Implement + wire UI**

```ts
export function riskScore(input: { startup: number; autorunFlags: number; defenderOn: boolean }): { score: number; level: "low" | "medium" | "high" } {
  let score = 100;
  score -= Math.min(30, Math.max(0, input.startup - 3) * 3);
  score -= Math.min(40, input.autorunFlags * 8);
  if (!input.defenderOn) score -= 30;
  score = Math.max(0, score);
  return { score, level: score >= 75 ? "low" : score >= 40 ? "medium" : "high" };
}
```

Organize: rule `<select>` + "Auto-resolve" button per group calling `resolve_duplicate_group` then existing `remove_duplicates`. Dashboard: Risk card with `title` explaining the three inputs (no black box).

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test pick_removals resolve_
npm test -- src/lib/risk.test.ts
npx tsc --noEmit
npm run lint
npm run test:a11y
node scripts/check-arg-parity.mjs
```

- [ ] **Step 5: Commit (two commits: Rust, then frontend)**

```bash
git add -- src-tauri/src/duplicates.rs src-tauri/src/lib.rs
git commit -m "feat: duplicate auto-resolution rules with survivor tests"
git add -- src/lib/risk.ts src/lib/risk.test.ts src/views/Organize.tsx src/views/Dashboard.tsx src/i18n/en.json src/i18n/es.json src/i18n/de.json
git commit -m "feat: one-click dupe auto-resolve and Dashboard risk score"
```

---

### Task 10: Backlog P1s — per-app looks + right-click themer (ROADMAP D1)

**Files:**
- Create: `src-tauri/src/applooks.rs` (`AppLookRule { exe, look_id }`, `match_look(exe, rules)`, `list/set_app_look_rules` over `app_looks.json`, foreground poller hooking existing apply paths)
- Create: `src-tauri/src/contextmenu.rs` (`install_context_menu` / `remove_context_menu` under `HKCU\Software\Classes\DesktopBackground\shell\Reforge`, undo entries both ways)
- Modify: `src-tauri/src/lib.rs` (new modules + ` --view <name>` CLI parse + registration)
- Modify: `src/App.tsx` (startup deep-link via `take_launch_view` one-shot command)
- Test: Rust matching/registry-command-builder tests; frontend switcher test

**Interfaces:**
- Consumes: existing `apply_style` / `marketplace_apply_bundle`; `undo::log_entry` BEFORE registry writes; `ps_single_quote` for the menu command string.
- Produces: `app_looks.json` rules; two desktop verbs ("Apply Reforge look" → Makeover, "Set wallpaper" → Style Studio).

**Done when:** naming `game.exe` in rules applies its look when the process appears (poll honors a 30s cooldown, never steals focus); both verbs install/remove cleanly with undo entries.

- [ ] **Step 1: Write the failing matching test**

```rust
#[test]
fn exe_match_is_case_insensitive_filename_only() {
    let rules = vec![AppLookRule { exe: "game.exe".into(), look_id: "night".into() }];
    assert_eq!(match_look(r"C:\G\GAME.EXE", &rules).as_deref(), Some("night"));
    assert_eq!(match_look(r"C:\G\other.exe", &rules), None);
}
```

Run: `cargo test exe_match` (MSVC prompt). Expected: FAIL (module missing).

- [ ] **Step 2: Implement matching + rules CRUD**

```rust
pub fn match_look(running_path: &str, rules: &[AppLookRule]) -> Option<String> {
    let file = running_path.rsplit(['\\', '/']).next().unwrap_or(running_path);
    rules.iter().find(|r| r.exe.eq_ignore_ascii_case(file)).map(|r| r.look_id.clone())
}
```

Poller: every 15s list foreground/top processes via existing `sysinfo` dependency, apply on transition only (track last-applied exe + 30s cooldown), log `app_look_applied` undo entries. Never kill, never inject — read-only observation.

- [ ] **Step 3: Implement the context menu (registry, undoable)**

```rust
const MENU_KEY = r"Software\Classes\DesktopBackground\shell\Reforge.Look";
pub fn install_context_menu(exe: &Path) -> Result<String, AppError> {
    // verbs: "Apply Reforge look" -> `"<exe>" --view makeover`
    //        "Set wallpaper"     -> `"<exe>" --view styles`
    // command strings built with ps_single_quote; undo entry BEFORE writing
}
```

`--view <name>` parsed in `parse_cli_arg`-adjacent pure fn (`parse_view_flag`, tested); `App.tsx` consumes it once at startup via `take_launch_view`.

- [ ] **Step 4: Verify**

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test applooks contextmenu parse_view
npm test
npx tsc --noEmit
npm run lint
npm run test:a11y
node scripts/check-arg-parity.mjs
```

Manual gate: install verbs on a test machine, right-click desktop → both verbs open the right view; remove verbs; confirm registry clean + undo entries revert.

- [ ] **Step 5: Commit (three commits: applooks, contextmenu+CLI, frontend)**

```bash
git add -- src-tauri/src/applooks.rs src-tauri/src/lib.rs
git commit -m "feat: per-app looks with cooldown and matching tests"
git add -- src-tauri/src/contextmenu.rs
git commit -m "feat: undoable desktop right-click verbs with deep-link flags"
git add -- src/App.tsx src/lib/types.ts src/lib/mock.ts
git commit -m "feat: startup view deep-link for context menu verbs"
```

---

### Task 11: Signature motion set (original components, no ReactBits copying)

**Files:**
- Create: `src/components/motion/TiltCard.tsx`, `SpotlightCard.tsx`, `MagneticButton.tsx`, `BlurReveal.tsx`, `LookCarousel.tsx`, `FolderPreview.tsx` (+ one `motion.test.tsx` covering all six)
- Modify: `src/index.css` (shared keyframes only; per-component motion lives in the components)
- Modify: `src/views/Marketplace.tsx` (TiltCard + SpotlightCard + LookCarousel for packs), `src/views/Makeover.tsx` (BlurReveal completion), `src/views/Organize.tsx` (FolderPreview), `src/features/widgets/hub.tsx` (MagneticButton triggers)

**Interfaces:**
- Consumes: Task 3 tokens; `prefers-reduced-motion` + `(hover: hover) and (pointer: fine)` gating.
- Produces: six tested primitives; dense screens (Settings, Security) stay motion-free.

**Done when:** every primitive freezes under reduced-motion, works by keyboard where interactive, and never moves a click target while pointer is down.

- [ ] **Step 1: Write the failing shared test**

```tsx
it("all motion primitives freeze under reduced motion", () => {
  stubReduced(true);
  render(<><TiltCard title="t" /><SpotlightCard><span>x</span></SpotlightCard><MagneticButton label="go" /><BlurReveal text="done" /><LookCarousel items={["a", "b"]} /><FolderPreview name="f" count={3} /></>);
  expect(document.querySelectorAll("[data-motion-frozen]").length).toBe(6);
});
```

Run: `npm test -- src/components/motion/motion.test.tsx`. Expected: FAIL (components missing).

- [ ] **Step 2: Implement one primitive at a time** (TDD per primitive: TiltCard → SpotlightCard → MagneticButton → BlurReveal → LookCarousel → FolderPreview). Rules baked into each: `data-motion-frozen` + static render when reduced-motion matches; no global key listeners (carousel keys scoped to its region, cf. Task 4); MagneticButton translates at most 2px and snaps back on leave/up; FolderPreview is a button with `aria-expanded`.

- [ ] **Step 3: Wire into the four views** (replace the Task 3/4 hover tweaks where the primitives supersede them; delete dead CSS).

- [ ] **Step 4: Verify**

```bash
npm test -- src/components/motion/motion.test.tsx
npx tsc --noEmit
npm run lint
npm run test:a11y
node scripts/check-i18n-hardcoded.mjs
```

Expected: motion tests green; hardcoded count unchanged (labels go straight to catalogs).

- [ ] **Step 5: Commit per primitive** (six small commits, one per component + wiring).

---

### Task 12: Release hardening — topology rig, away-log, startup budget (ROADMAP X-3/X-4/X-8)

**Files:**
- Modify: `src-tauri/src/wallpaper_video.rs` (extend existing `find_monitor_rect` tests into a scripted topology rig covering add/remove/reorder + DPI note), `src-tauri/src/wallpaper_static.rs` (same rig for the static path)
- Modify: `src/views/History.tsx` (promote Task 5's away-line: "while you were away" panel listing undo entries newer than last launch marker in `localStorage`)
- Modify: `scripts/check-startup-budget.sh` only with measured headroom (Task 7 owns the numbers; this task consumes them)
- Test: Rust topology tests; History away-panel test with seeded timestamps

**Interfaces:**
- Consumes: `MonitorRect { name, x, y, w, h }` convention from `wallpaper_video.rs`; undo `ts` fields; `reforge-last-launch` localStorage marker set at startup.
- Produces: one rig both wallpaper paths share; honest away-log (empty state when nothing happened).

**Done when:** topology changes resolve to the right monitor in tests; History shows exactly the changes since last launch; budget file reflects a measured value.

- [ ] **Step 1: Write the failing topology test**

```rust
#[test]
fn reorder_and_removal_resolve_by_monitor_id_not_index() {
    let before = vec![rect("A", 0, 0, 1920, 1080), rect("B", 1920, 0, 1920, 1080)];
    let after = vec![rect("B", 0, 0, 1920, 1080)]; // A unplugged, B became primary
    assert_eq!(resolve_placement(&after, &Some("B".into())), Some(rect("B", 0, 0, 1920, 1080)));
    assert_eq!(resolve_placement(&after, &Some("A".into())), None); // falls back to virtual screen
}
```

Run: `cargo test resolve_placement` (MSVC prompt). Expected: FAIL (function missing).

- [ ] **Step 2: Implement `resolve_placement` in `wallpaper_video.rs`, reuse from `wallpaper_static.rs`** (one rig, both paths; DPI changes need no code — placement is in physical pixels — but record that as a code comment with the reasoning).

- [ ] **Step 3: Build the away-log panel** (read `reforge-last-launch`, filter undo entries newer than it, render count + top 3 with links; write the marker at startup in `App.tsx`).

- [ ] **Step 4: Verify**

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test resolve_placement topology
npm test -- src/views/History.test.tsx src/views/s3-history.test.tsx
npx tsc --noEmit
npm run lint
npm run test:a11y
bash scripts/check-startup-budget.sh
```

- [ ] **Step 5: Commit (three commits: rig, away-log, budget)**

```bash
git add -- src-tauri/src/wallpaper_video.rs src-tauri/src/wallpaper_static.rs
git commit -m "feat: shared monitor-topology rig for video and static paths"
git add -- src/views/History.tsx src/App.tsx
git commit -m "feat: while-you-were-away panel from local undo log"
git add -- scripts/check-startup-budget.sh docs/DELIVERY.md
git commit -m "chore: startup budget from measured handoff"
```

## Self-review

- **Spec coverage:** S Tasks 0/7/12 (X-9) + Task 8 (S) · M visual gaps Tasks 3/4/11 (M-3 gate inside each) · P decisions already in DELIVERY (no task needed) · X-1 Task 1 (+ratchet; full 954-string tail tracked, not scheduled) · X-2 Task 2 · X-3 Task 12 topology rig · X-4 Task 5 away-line + Task 12 away-panel · X-5 already declined (DELIVERY) · X-6 Task 5 · X-7 Task 6 + shipped CLI/config inventory (registry view inside Task 6) · X-8 Task 7/12 · X-10 Task 8 · Backlog D1/D2/D4 P1s Tasks 9/10.
- **Gap fixed:** Task 5 now also renders a "while you were away" line (newest undo entry ts via `fmtAge`) so X-4's event-log story is covered.
- **Placeholder scan:** no TBD/TODO; every step names exact files, commands, and expected outputs.
- **Type consistency:** `bucketByMonth` returns `DayBucket[]` matching `bucketByDay`; `RegistryValue { path, name, value, kind }` matches mock/UI; `CliAction` unchanged (no new variants); `power.*`/`analytics.*`/`settings.advanced.*` keys added to all three locales together.
