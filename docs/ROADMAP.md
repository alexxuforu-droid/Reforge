# ═══════════════════════════════════════════════════════════════════════════════
#   REFORGE — THE MASTER ROADMAP
#   Version 2.1 · v1.0.0 shipped 2026-09-18 (see CHANGELOG.md); Part C phases
#   S/M/P/X now recorded below with their outcomes · consolidated 2026-08-22
# ═══════════════════════════════════════════════════════════════════════════════
#
#   Reforge is a Windows app that gives your PC a "spa day": restyle how it
#   looks, clean out the junk, speed it up, and tighten up privacy — and every
#   single change can be undone with one click.
#
#   This file is the project's single forward-facing plan. Version 2.0 absorbs
#   the now-deleted workspace plan documents (TWO_STANDARDS_MASTER_PLAN,
#   NEXT_UPDATE_PLAN, NO_SLOP_UPDATE_PLAN) whose Reforge work has shipped, and
#   carries everything still open from ROADMAP v1.1 forward. Nothing was lost
#   in the consolidation: every unfinished item from every superseded doc that
#   touches Reforge lives in PART C; cross-project leftovers live in the
#   Appendix (PART G).
#
#   Governing standards:
#     · docs/standards/UNIVERSAL_STANDARD.md (workspace root) — the consolidated quality bar
#     · Each repo's DESIGN.md — stated exceptions (palette, theme, errors)
#
#   Legend for work items:
#     [x] done · [ ] not started · [~] partially done
#     🟡 needs a decision 🟢 small (hours) 🟠 medium (1–2 days) 🔵 large (2–4 days)
#
#   CONTENTS
#   ─────────────────────────────────────────────────────────────────────────────
#   PART A — WHERE THE PROJECT STANDS ....... the audited baseline + what already shipped
#   PART B — THE PROMISE .................... reversibility, anti-goals (unchanged)
#   PART C — THE ROADMAP .................... 5 phases from "now" to v1.0
#   PART D — THE BACKLOG .................... the evergreen idea pool (D1–D7)
#   PART E — QUALITY, METRICS, RISKS ........ gates, signals, honest notes
#   PART F — HOW TO USE THIS ................ workflow for turning this into work
#   PART G — APPENDIX: CROSS-PROJECT CARRYOVER ... whip-duo items owed from V3.1/V3.5
#
# ═══════════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────────
#  THE 30-SECOND GUIDE
# ───────────────────────────────────────────────────────────────────────────────

Reforge is a **big, working product**: 17 sections, 263 backend commands,
~49,000 lines, 116+ Rust tests, 35+ frontend test files, a wallpaper engine,
desktop widgets, a full undo system, a Windows Security Center UI, packs with
share codes, an updater pipeline, and a landing page ready to go live.

**Everything from the old standards-conformance plans has shipped:** typed
`AppError` end-to-end, typed IPC + `errorCopy()`, OS accent at boot + live
follow, dark theme, flat skeletons, async long ops with progress events,
`tracing`, shell-injection audit, Mica, Style Studio remix mode, mock split out
of the bundle, `THIRD_PARTY_NOTICES.md` + wallpaper attribution, `DESIGN.md`,
conventional commits.

What remains is small and sharply defined:

| Phase | Name | The point, in one sentence |
|---|---|---|
| S | **Ship it** | Run the release pipeline end-to-end, prove the update loop live, publish v0.1.0. *~half a day.* |
| M | **Makeover finish line** | The three deferred Style Studio scraps: per-monitor video, RGB restore-on-exit, full accessibility sweep. *1–2 days.* |
| P | **Packs 3.0 decisions** | Theme trio generator + community gallery decision. *0–2 days.* |
| X | **v1.0 — Scale** | Full i18n, E2E tests, multi-monitor perfection, background reliability, final perf + security pass. *3–5 days.* |
| B | **Backlog pulls** | Pull from PART D as capacity frees up. *ongoing.* |

Total: roughly **1 week of effort** to a genuinely polished v1.0. Phases are
effort estimates, not calendar promises — only the owner's release review
gates calendar time (Phase S).

---

# ═══════════════════════════════════════════════════════════════════════════════
#  PART A — WHERE THE PROJECT STANDS
# ═══════════════════════════════════════════════════════════════════════════════

## A1 · The numbers (measured; re-verify against the tree when this file is touched)

| Metric | Value |
|---|---|
| Rust backend modules | **57** (`src-tauri/src/*.rs`) |
| Backend commands | **263** |
| Rust unit tests | **116+** (incl. pack-security + undo-cap suites) |
| Frontend sections/views | **17** |
| Frontend test files | **35+** (incl. s3 click-through suite) |
| Total tracked code | **~49,000 lines** |
| Mock backend | `src/lib/mock.ts`, dynamically imported — not in the prod bundle |
| Translations | `en` real · `es` partial |
| Release exe | ~320 MB + 98 MB ffmpeg sidecar (deliberate — `DELIVERY.md` §3) |
| CI | tsc + lint + vitest + parity/a11y audits + cargo test/clippy/fmt + startup budget |
| Git | conventional prefixes, atomic commits; remote → `vasilescualex07-droid/Reforge` |

## A2 · What already shipped (the consolidated record)

### Product phases (old roadmap v1.1)

- ✅ **Phase 0 "Ship the truth"** — README/spec/release-plan rewritten to match reality;
  updater URL verified correct; Rust checks in CI (`P0-5`). *Remaining: P0-6/7/9/10 → Phase S below.*
- ✅ **Phase 1 "Security Center on screen"** — all 14 items (defender grid, threat drill-down,
  third-party AV card, exclusions manager, CFA allowlist, RT-disable countdown, live scan
  progress, dashboard digest, autorun detail, elevation relaunch flow, splash settings,
  capability-aware taskbar controls, mock parity, tests). Complete 2026-08-16.
- ✅ **Phase 2 "Makeover depth"** — 9 of 11 items fully done (sound editor UX, font previews,
  taskbar preview, lock-screen picker, screensaver preview, pack engine v2 groundwork with
  media-carrying bundles + scene export, video import presets + loop/pause). *Remaining:
  P2-1 per-monitor video, P2-9 RGB exit hook, P2-10 theme trio generator, P2-11 full a11y sweep → Phase M/P.*
- ✅ **Phase 3 "Trust & reliability"** — all 11 items (integration-style tests incl. the
  pack-checksum walkdir bugfix, CI runs everything, unwrap sweep, errorCopy everywhere,
  async hardening + call timeouts, startup budget enforced in CI, diagnostics bundle,
  telemetry decided permanently local, undo-log cap tested, code-split verified,
  battery etiquette).
- ✅ **Phase 4 "Distribution & updates"** — portable zip artifact + docs, release notes in
  the updater manifest, landing page built (one owner click to go live), repo-size guard,
  SmartScreen honesty in-app, community files. *Remaining: live end-to-end proof → Phase S.*
- ✅ **Phase 5 "Packs 2.0"** — manifest v2 (schema version + changelog), preview canvas,
  20-char share codes, export-current-look, checksums (asset-covered), scheduled pack
  rotation, applied-count stats. *Deferred by decision: gallery (P5-5), theme trio generator (P2-10).*

### Standards conformance (the deleted workspace plans)

- ✅ Typed `AppError` (`error.rs`) across every command; structured variants on hot paths;
  zero production unwraps.
- ✅ One typed IPC layer (`api.ts` wrappers) + mirrored `AppErrorShape` union +
  `errorCopy()`; zero "Something went wrong" copy.
- ✅ Mock split into `src/lib/mock.ts`, dynamically imported — browser preview byte-identical,
  prod bundle lighter.
- ✅ Boot follows OS theme + accent; live accent re-poll (~5s); dark theme via
  `prefers-color-scheme`; Theme Studio stays as the explicit override.
- ✅ Chrome cleanup: flat skeleton pulse, no decorative gradients, content-preview comments,
  focus-visible rings, four-state coverage.
- ✅ Async long ops (`duplicates`, `transcode`) off-thread with `scan-progress` /
  `transcode-progress` events; frontend timeouts.
- ✅ `tracing` subscriber; shell-invocation audit logged; inputs validated Rust-side.
- ✅ Mica window material; Style Studio remix mode (`styleRemix.ts`) with save-as-style.
- ✅ `THIRD_PARTY_NOTICES.md` + `public/wallpapers/ATTRIBUTION.md`; `DESIGN.md` states the
  palette/theme/error/capability/logging decisions.
- ✅ Conventional atomic commits in the repo history.

## A3 · The product promise (unchanged)

- **Undo log** written before mutation; **versioned snapshots**; **Factory Fresh**.
- Dry-run-first cleanup; staging trash; backups before registry/Wi-Fi changes.
- Local-first: nothing leaves the machine; telemetry rejected permanently
  (`DELIVERY.md` §4); unsigned by decision (`DELIVERY.md` §1).

## A4 · Anti-goals (unchanged, hard)

1. No DLL injection or hack patches. 2. No boot/login skinning. 3. No irreversible deletion.
4. No telemetry without consent (and none planned). 5. No vendor SDK lock-in.
6. No server dependency for core features. 7. No driver installs, blind registry deletes,
or shell-string concatenation from user input.

---

# ═══════════════════════════════════════════════════════════════════════════════
#  PART C — THE ROADMAP: FIVE PHASES TO v1.0
# ═══════════════════════════════════════════════════════════════════════════════

```
now ──► S ──► M ──► P ──► X ──► v1.0
        ship  makeover packs  scale
```

Every phase has: **What this phase is**, **Done when**, and **The work**
(each item says what it is and why it matters).

---

## PHASE S — "SHIP IT" 🟠 (~½ day) · BLOCKER FOR EVERYTHING ELSE

### What this phase is

The delivery machinery exists and is correct but has never carried a real
release end-to-end. This phase proves the loop once, with you as the manual
gate. Until it's done, "check for updates" can't succeed and the download page
has nothing to serve.

### Done when

A real release is live on GitHub Releases with installer + MSI + portable zip +
update manifest; a second, higher version bump installs silently through the
in-app updater on a test machine; the local git remote URL is current.

### The work

| # | Item | What / why | Size |
|---|---|---|---|
| S-1 | Run the release workflow end-to-end | Trigger from the existing `v0.1.0` tag (or re-tag); verify exe + NSIS + MSI + `latest.json` + portable zip land as a draft release. First full exercise of `.github/workflows/release.yml`. | 🟠 |
| S-2 | Publish the draft | Owner's manual gate. Landing page (`site/index.html` + `pages.yml`) goes live the moment a published release exists — Settings → Pages → Source: GitHub Actions. | 🟢 |
| S-3 | Prove the in-app update loop live | Bump a test version above the published one; confirm check → download → sha256 verify → stage → silent NSIS install works from the live channel. Every future release depends on this path. | 🟠 |
| S-4 | Refresh the local git remote | `git remote set-url origin https://github.com/vasilescualex07-droid/Reforge.git` (still says `Reforged`; GitHub redirects today but the stale name confuses audits). | 🟢 |
| S-5 | Post-release smoke on a clean account | Fresh install → shortcut present → launch → apply a look → revert → uninstall clean. The Universal Standard release gate. | 🟢 |

---

## PHASE M — "MAKEOVER FINISH LINE" 🟠 (1–2 days)

### What this phase is

Style Studio is a finished creative product except for three deliberately
deferred scraps from Phase 2 of the old roadmap. Land them and the makeover
half of the app has no known gaps.

### Done when

Video wallpapers place per-monitor; RGB devices restore their previous mode when
Reforge exits; every view passes the full keyboard/contrast sweep in both themes.

### The work

| # | Item | What / why | Size |
|---|---|---|---|
| M-1 | Per-monitor video wallpapers | `wallpaper_video.rs` currently targets the main monitor. Extend placement per display via the same topology handling static per-monitor wallpapers use (`IDesktopWallpaper` monitor IDs). Deferred from P2-1 because it's genuinely multi-monitor work — do it together with X-3 so both video and static paths get one topology test rig. | 🟠 |
| M-2 | RGB restore-on-exit hook | `rgb_set_zone_static` + per-zone colors shipped; the promised "restore previous mode on exit" never landed because it needs an exit hook. Wire `on_window_event`/`RunEvent::Exit` → restore saved mode per device, best-effort, logged. Graceful when OpenRGB is gone. | 🟢 |
| M-3 | Full accessibility & contrast sweep | P2-11 covered new controls only. Walk all 17 views: visible focus ring on every interactive element (define `--focus-ring` from the accent if missing anywhere), tab order, `aria-*` on stateful controls, AA contrast in light AND dark, reduced-motion honored. Fix what fails; run `npm run test:a11y` as the gate. | 🟠 |

---

## PHASE P — "PACKS 3.0 DECISIONS" 🟡🟠 (0–2 days)

### What this phase is

Two deliberate deferrals from Packs 2.0, plus the standing decision register.
Decide them explicitly — decide-to-not-build is a valid outcome; silent drift is not.

### Done when

Both items are either built or recorded as declined in `docs/DELIVERY.md`.

### The work

| # | Item | What / why | Size |
|---|---|---|---|
| P-1 🟡 | Community gallery (was P5-5) | Read-only GitHub-repo-of-bundles as the "server": fetch index, download, checksum-verify, import. Zero accounts, zero servers we run, zero telemetry. Share codes already cover offline sharing; build this only if packs see real use after launch. Default if built: `vasilescualex07-droid/reforge-gallery` with a JSON index. | 🟠 |
| P-2 🟡 | Theme trio generator (was P2-10) | Auto-generate a matching accent + mode + wallpaper per pack instead of only capturing the current look. Content-generation work — belongs here now that capture covers everything. Reuse the desktop-mock preview canvas. Cut freely. | 🟠 |
| P-3 | Decision register refresh | Record outcomes in `DELIVERY.md`: gallery, trio generator, MSIX (declined unless enterprise demand appears), cloud backup (X-5). One table, dated, no ambiguity. | 🟢 |

---

## PHASE X — "v1.0 — SCALE" 🔵 (3–5 days)

### What this phase is

The 1.0 that feels like a company shipped it: localized, protected by
end-to-end tests, flawless across monitors and DPI changes, reliable across
reboots, fast under sustained use, and security-reviewed.

### Done when

v1.0 ships with 3+ full locales, automated browser-level coverage of the core
journeys, multi-monitor polish, documented optional cloud path (even if the
decision is "no"), and the perf/security passes green.

### The work

| # | Item | What / why | Size |
|---|---|---|---|
| X-1 | Full i18n | Extract every hardcoded string to `en.json`; complete `es.json`; add a third locale; add a test that fails when a view hardcodes UI strings. The biggest raw-hours item — consider locale-by-locale slicing (en→es→de/fr). | 🔵 |
| X-2 | E2E journey tests | Playwright (or WebdriverIO) against the mock backend for the top-10 journeys: makeover apply+undo, junk scan+clean, duplicates scan+restore, pack import/apply/revert, share-code round-trip, update check, security scan, settings persistence, command palette navigation, factory-fresh restore. These protect every future refactor. | 🔵 |
| X-3 | Multi-monitor correctness | Per-monitor wallpapers AND video (with M-1), display-profile apply across topology changes, DPI change mid-session, mixed refresh rates. Build one scripted topology test harness and use it for both static and video paths. | 🟠 |
| X-4 | Background reliability | Scheduled maintenance, blue-light filter, macros, and pack rotation surviving reboot — stress the existing restore plan; add an event-log story ("what did Reforge do while I was away") surfaced in History. | 🟠 |
| X-5 🟡 | Optional cloud backup (decision) | Encrypted backup of profile + undo history to the user's OWN storage (OneDrive/Drive folder — local API, no Reforge server), opt-in, local-first default untouched. Decide and record; declining is acceptable and ends the item. | 🔵 |
| X-6 | Analytics dashboard | Storage freed, time saved, health trend over months — the data is already recorded locally; render it. Pure win, no new collection. | 🟠 |
| X-7 | Power-user surface | Document every `*_config.json`; CLI flags beyond `--version`; advanced registry view (read-only) behind a settings toggle. | 🟠 |
| X-8 | Performance final pass | Cold start under ~2s (splash handoff contract already measured in `startup.log` and CI-enforced at 8s — tighten the budget), idle memory under ~200MB, no jank on scan-heavy views. Profile first; fix what the profiler indicts, not vibes. | 🟠 |
| X-9 | Security review | Capability-file audit, IPC input-validation sweep, PowerShell argument-injection review (DESIGN.md records the last audit as clean — re-verify against the current tree), pack importer fuzz pass (extension + content-sniff + size caps). | 🟠 |
| X-10 | Version 1.0 + release | Bump to 1.0.0 everywhere, CHANGELOG, README status flip, tag, run Phase S's proven pipeline, publish. | 🟢 |

---

## TIMELINE AT A GLANCE

| Phase | Effort | Cumulative |
|---|---|---|
| S · Ship it | ~½ day | ~½ day |
| M · Makeover finish line | 1–2 days | ~2 days |
| P · Packs 3.0 decisions | 0–2 days | ~3 days |
| X · Scale | 3–5 days | ~1 week |
| B · Backlog pulls | ongoing | — |

Roughly **one week of effort** to v1.0 at this codebase's demonstrated pace.
Calendar time stretches only where the owner gates it (S-2 publishing).

---

# ═══════════════════════════════════════════════════════════════════════════════
#  PART D — THE BACKLOG (EVERGREEN IDEA POOL)
# ═══════════════════════════════════════════════════════════════════════════════

Priorities: **P0** = do soon · **P1** = strong candidate · **P2** = if it gets votes.
Pull into any phase when there's room. Everything is scoped to existing architecture —
nothing here invents a new system. Carried intact from ROADMAP v1.1.

## D1 · Makeover & personalization

- [ ] **P1** Per-app looks — "when app X starts, apply look Y". The macro engine already watches processes; make macros visual.
- [ ] **P1** Right-click themer — right-click desktop → "Apply Reforge look / Set wallpaper" via existing shell machinery.
- [ ] **P2** Folder color-coding — research `desktop.ini`-based icons with an honest capability gate first.
- [ ] **P2** Icon packs — icon themes + icon-cache rebuild + Explorer restart through the pending-restart orchestrator.
- [ ] **P2** Animated cursor packs (`.ani`) — import + apply as a scheme.
- [ ] **P2** Audio-reactive wallpaper scenes — `symphonia`/`hound` already available; scenes could pulse to music.
- [ ] **P2** Wallpaper ambience packs — subtle motion + sound tied to a look.

## D2 · Tune-up & cleanup

- [ ] **P1** Scheduled junk-clean with before/after size report — make "weekly tidy" a one-tap promise.
- [ ] **P1** Per-browser cache breakdown — show Chrome/Edge/Firefox cache sizes before cleaning.
- [ ] **P2** "What changed since my last tune-up" diff — the undo log already records everything.
- [ ] **P2** Driver update checker — read-only + manufacturer link; never install drivers.

## D3 · Organize

- [ ] **P1** Duplicate auto-resolution rules — keep-newest / keep-in-folder-X / keep-smaller for one-click dupes.
- [ ] **P1** Storage forecast — "at this rate you'll run out in N months" from storage-radar history.
- [ ] **P2** Photo library organizer — EXIF-date routing; extends the screenshot-organizer pattern.
- [ ] **P2** Archive-to-cloud cold storage — zip + send to the user's own OneDrive/Drive folder; local API, no backend.

## D4 · Security & privacy

- [ ] **P1** One "Risk score" — fold startup risk + autorun audit + Defender status into a Dashboard number.
- [ ] **P1** Wi-Fi security audit — WPA2/3 detection, open networks, saved-network exposure.
- [ ] **P1** Browser privacy "restore defaults" — one click back to stock policies.
- [ ] **P2** USB history export (CSV).
- [ ] **P2** Mic/camera access log drill-down from Windows audit events.

## D5 · Productivity · Network · Gaming · Displays · Power

- [ ] **P1** Clipboard manager v2 — images + rich text, drag-out, per-app pinning.
- [ ] **P1** Focus mode scheduling — "no distractions 9–11 AM" via the automation engine.
- [ ] **P1** Per-app bandwidth history chart — sample `get_bandwidth_hogs` over time.
- [ ] **P2** Gaming: per-game power plans (Game Mode + power plan per game).
- [ ] **P2** Displays: ICC color profile management.
- [ ] **P2** Power: per-app battery usage view.

## D6 · Core & UX

- [ ] **P1** Real notifications — replace the demo bell items with real events (maintenance failed, scan done, update available).
- [ ] **P1** History filters — filter by kind (wallpaper / cleanup / security / …) + search.
- [ ] **P1** Guest profile — demo mode that resets on exit; snapshots make this cheap.
- [ ] **P2** Command palette v2 — fuzzy search, recent actions, icons.
- [ ] **P2** Onboarding v2 — tie the wizard to the capability matrix ("here's what THIS PC supports").
- [ ] **P2** `.theme` file import — parse Windows theme INI files per the original spec.

## D7 · Platform & engineering

- [ ] **P1** Faster cold builds — sccache, dependency bloat audit.
- [ ] **P2** Win10/11 parity matrix rendered in Settings — the capability matrix already computes it.
- [ ] **P2** ARM64 build — audit `windows` crate usage for ARM compatibility.
- [ ] **P2** WebView2 offline installer fallback for locked-down machines.
- [ ] **P2** Winget manifest + Scoop bucket — one-command installs.

---

# ═══════════════════════════════════════════════════════════════════════════════
#  PART E — QUALITY, METRICS, RISKS
# ═══════════════════════════════════════════════════════════════════════════════

## E1 · Quality gates — "done" means all of these, every phase

Per `docs/standards/UNIVERSAL_STANDARD.md` §5, concretely for Reforge:

1. `npx tsc --noEmit` clean · `npm run lint` clean (0 warnings) · `npm test` green.
2. `cargo test` green · `cargo clippy -- -D warnings` clean · `cargo fmt --check` clean.
3. Every new command: typed `Result<T, AppError>`, no `unwrap()`/`expect()`,
   inputs validated Rust-side, undo entry written BEFORE mutation.
4. Every new UI: loading / empty / error / populated; keyboard-operable;
   light + dark + OS accent; `test:a11y` green.
5. Mock parity grows with every new command (`check-arg-parity` gate).
6. Every failure renders shaped copy via `errorCopy()`, never a raw toast.
7. Startup handoff within budget (`scripts/check-startup-budget.sh`, `DELIVERY.md` §2).
8. Release work additionally: fresh-install smoke + update-loop proof (Phase S gates).

## E2 · Metrics & signals

| Signal | Today | Target (v1.0) |
|---|---|---|
| Commands with no UI | ~0 (Security Center closed the gap) | 0 |
| Docs contradicting code | none known | 0 (keep it that way) |
| Release pipeline run end-to-end | not yet | every tag, green < 90 min |
| In-app updates proven live | no | verified on every release |
| Locales | en full, es partial | 3+ full, no hardcoded strings |
| E2E journeys covered | 0 | top-10 automated |
| Multi-monitor | static ✓ / video ✗ | both, with a topology test rig |
| Startup handoff | CI-enforced ≤8s | tighten toward ~2s cold |
| Decisions without a written outcome | gallery, trio, MSIX, cloud | 0 (register in DELIVERY.md) |

## E3 · Risks & honest notes

- **The updater has never carried a real release.** Phase S exists solely to kill
  this risk; nothing else ships until it does.
- **Unsigned by decision** — SmartScreen shows "Unknown publisher"; trust builds
  through download reputation over months. Frequent updates through one stable exe
  accelerate it. Never pretended away (`DELIVERY.md` §1).
- **Repo size (~392 MB)** near the 1 GB soft limit; ffmpeg.exe at 98 MB sits just
  under the 100 MB/file hard cap. `check-repo-size.sh` guards; move media to Git LFS
  if growth continues.
- **The mock must track 263 commands** or browser preview diverges silently. The
  parity tests are the guard — extend them, don't bypass them.
- **Win10 vs Win11 parity is a permanent tax** (taskbar, lock screen, boot). The
  capability matrix makes it honest, not free.
- **320 MB exe** is a deliberate trade; revisit past ~400 MB (`DELIVERY.md` §3).
- **Two deferred decisions could grow scope** (gallery, cloud backup). Defaults if
  ever built: GitHub-repo-as-channel; user-owned storage. Never a Reforge-hosted server.

---

# ═══════════════════════════════════════════════════════════════════════════════
#  PART F — HOW TO USE THIS ROADMAP
# ═══════════════════════════════════════════════════════════════════════════════

1. **Work in phase order:** S → M → P → X, pulling backlog items (PART D) into any
   phase that has room. S is the blocker; M is the most user-visible value per hour.
2. **A phase is done when its "Done when" paragraph is true**, not when the checklist
   is exhausted. If an item turns out unnecessary, say so and cut it.
3. **Balance the mix** (33/33/33 bug-fix / improvement / feature) on any multi-task
   session drawn from this file; state the tally in the session plan.
4. **Keep this file honest.** When audit numbers change, update Part A. When a decision
   lands, record it in DELIVERY.md and tick the item. Bump the header version with a
   dated note.
5. **The README links here.** This file is Reforge's single forward-facing plan;
   superseded plan documents have been deleted rather than left to contradict it.

---

# ═══════════════════════════════════════════════════════════════════════════════
#  PART G — APPENDIX: CROSS-PROJECT CARRYOVER (NOT REFORGE WORK)
# ═══════════════════════════════════════════════════════════════════════════════

These items belong to the whip projects (WHIP WHIPPER, whip widget). They were
left open when `V3_1_AND_V3_5_PLAN.md` was retired; they are recorded here so
nothing was lost in consolidation. Work them in those repos under their own
standards (`docs/standards/UNIVERSAL_STANDARD.md` applies there too).

## G1 · Whip Whipper — V3.1 polish owed

| Item | What it is |
|---|---|
| E1.1 Editor write throttle | Throttle Target-Editor drag persistence to ≤10 writes/sec (flush on pointerup + 100ms interval); preview uses live state. |
| E1.2 Save-size guard | Estimate JSON length pre-autosave; warn via banner near ~4.5 MB; never throw inside the save path. |
| E1.3 VFX pool audit | Confirm pools stay capped (300/40/3) with power-scaled impacts + boss backdrop; 60fps @ 24 reps smoke. |
| E2.1 First-boss pacing | Validate chapter-1 economy can kill boss 1 in ~5–10 engaged minutes; retune `BOSS_HP_BASE`/manual damage if not. |
| E2.2 Manual relevance test | Economy test: manual-per-crack ≥ top affordable machine per-second for first ~10 owned; retune if drifting. |
| E2.3 Ascension perk sanity | Cap-check: no perk at tier 10 exceeds ×2.5 swing; adjust Head Start / +SPS if out of band. |
| E3.1 First-launch tutorial | 3-step dismissible overlay remembered in `settings.tutorialDone`. |
| E3.2 Next-goal hint | Slim HUD strip showing next campaign goal + %; click opens Campaign tab; toggle in Settings. |
| E4.1 Purist UI gating | Shop visually locks machines/power-ups in purist mode (disabled + note), no click errors. |
| E4.2 Pause-safety test | Gauntlet/target runs pause-safe + autosave-safe; engine test start→pause→resume→score integrity. |
| E4.3 NaN re-audit | Zero-guard sweep over braid strands, frame draw, sticker draw, arena bg bake. |
| E4.4 Sticker reorder UX | Del removes selected sticker; z-order buttons work on selection, not only via list. |

## G2 · Whip Whipper — older loose ends

| Item | What it is |
|---|---|
| Flaky economy test | One economy test observed flaky once under heavy parallel cargo load (passed 5×, failed 1×) — investigate or pin. |
| F3 settings dialog depth | Settings exist since v2 (save v3); re-verify the reset-progress destructive-confirm matches the exact consequence copy required by the standard. |

## G3 · Whip Cracker — loose ends

| Item | What it is |
|---|---|
| None open | F11 clear counter shipped in 3.5.0; README/DESIGN current; 21/21 tests green. Keep it that way. |

---

*Consolidated 2026-08-22 from the full audit lineage: ROADMAP v1.1 (2026-08-16),
TWO_STANDARDS_MASTER_PLAN, NEXT_UPDATE_PLAN, NO_SLOP_UPDATE_PLAN (all Reforge work
shipped and absorbed into Part A), FINAL_UPDATE/FINAL_RELEASE/NEXT_UPDATE/V3_1_V3_5
plans (whip-side leftovers preserved in Part G). If a number here disagrees with
the tree, the tree wins — update this file.*
