# REFORGE — PC Makeover

A "spa day for your PC." One Windows app that restyles, cleans, and optimizes your
machine in a guided, fully-reversible session — every change can be undone with one click.

Built with **Tauri 2 + Rust + React + TypeScript + Tailwind**.

> Windows only (Windows 10 & 11). See `docs/PC-Makeover-Spec.md` for the technical
> spec and `docs/ROADMAP.md` for the plan to v1.0.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL-3.0-blue.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/alexxuforu-droid/Reforge)](https://github.com/alexxuforu-droid/Reforge/releases)

> **Status (2026-09-18):** v1.0.0 — **17 sections, 255 backend commands**,
> 144 Rust tests, 10 browser journeys green, three locales (en/es/de).
> Releases are **unsigned by decision** — Windows may show
> "Unknown publisher" on first run; that's expected and never pretended away.
> Trust builds through SmartScreen download reputation over time (see
> `docs/DELIVERY.md` §1).

## Download & install

Grab the latest installer (e.g. `Reforge_1.0.0_x64-setup.exe`) from the
[Releases page](https://github.com/alexxuforu-droid/Reforge/releases) — a
per-user install, no admin rights needed. In-app, Settings → "Check for updates"
polls the same channel and installs newer versions silently (sha256-verified,
staged, then swapped by the NSIS installer).

## The 17 sections

| Section | What it does |
|---|---|
| **Dashboard** | Health + personalization scores, storage-freed / time-saved counters, quick actions, recent activity, resource hogs |
| **Makeover** | Guided, fully-reversible makeover session with style quiz and previews |
| **Style Studio** | The creative workshop (see below) |
| **Marketplace** | Local look packs (`.reforgepack`): import, export, apply, delete — one file, one atomic reversible apply |
| **Performance** | Live CPU/RAM/disk graphs, battery + battery health, top processes, resource leaderboard, history |
| **Tune-up** | Junk cleaner, startup manager, bloatware uninstaller, RAM optimizer, registry cleaner, power plans, task auditor, boot-time tracker, extension auditor, file-association reset, driver inventory |
| **Organize** | Duplicate finder, auto-sort, storage radar, biggest files, smart folders, archiver, batch rename, screenshot organizer, downloads expiry, unused-app flagging, cross-cloud dupes, Recycle Bin, Windows.old |
| **Security** | Security sweep, permission auditor (mic/cam/location kill-switch), browser privacy hardening, USB history, and a **Windows Security Center** (Defender health, quick/full scans, threats, Controlled Folder Access, ASR rules, autorun threat audit, definition updates) |
| **Productivity** | Clipboard history, quick launcher, if-then macros, focus mode |
| **Displays** | Monitor info, per-monitor wallpapers, display profiles |
| **Network** | Bandwidth hogs, Wi-Fi backup/forget/restore, network reset, VPN |
| **Gaming** | Game Mode, stream-safe layout, per-game profiles applied automatically |
| **Power** | Live battery, power plans, screen-off timeout, hibernate |
| **Accessibility** | Simplified mode, UI scaling, color-blind palettes, reduced motion |
| **History** | Undo timeline grouped by day, per-entry revert, versioned snapshots, Factory Fresh |
| **Widgets** | Fun corner: desktop overlays, achievements, boss key, screen capture |
| **Settings** | Automation schedules, blue light filter, media transcode presets, update channel, RGB lighting (OpenRGB), profile export/import, splash config |

## Style Studio — the creative workshop

| Feature | Status |
|---|---|
| **Animated Wallpaper Engine** — 20 procedural scenes (aurora, waves, particles, stars, matrix, embers…) in a borderless window behind your icons; battery-saver pause, freeze-frame, static restore, survives restarts | ✅ |
| **Wallpaper Studio** — template builder (8 scene types) with speed/density/color sliders + live preview | ✅ |
| **Video wallpapers** — MP4/WebM/GIF imported through a bundled ffmpeg pipeline (3 quality presets, progress events, 500 MB cap) | ✅ |
| **Wallpaper slideshow** — rotation + history, per-monitor `IDesktopWallpaper` COM | ✅ |
| **Theme Studio** — dark/light, accent color, transparency (registry + shell refresh, OS-follow) | ✅ |
| **Style packs & quiz** — 6 curated looks, procedural gradient wallpapers, deterministic 5-question quiz | ✅ |
| **Cursor schemes** — Aero / Black / system-default with undo | ✅ |
| **Sound schemes** — apply Windows schemes, set individual event sounds, preview, import assets, save your own | ✅ |
| **Fonts** — install per-user fonts, substitute system fonts (admin-gated, capability-checked) | ✅ |
| **Taskbar redesign** — size, alignment, autohide, color-match, position via a safe pending-restart orchestrator | ✅ |
| **Lock screen** — custom image, slideshow folder, spotlight toggle, hide lock-screen apps | ✅ |
| **Screensaver** — registers the app as the Windows screensaver; plays a scene fullscreen on idle, any input dismisses | ✅ |
| **Widget Engine** — clock, live CPU/RAM/disk stats, sticky notes, to-do, calendar (always-on-top, draggable, saved) | ✅ |

## Tune-up, cleanup & optimization

| Feature | Status |
|---|---|
| **Junk cleaner** — dry-run scan, sizes, confirm-before-delete, clean-now | ✅ |
| **Startup manager** — HKCU/HKLM Run + Startup folder, reversible disable | ✅ |
| **Bloatware uninstaller** — curated scan of pre-installed junk, launches the app's own uninstaller | ✅ |
| **RAM optimizer** — top memory consumers, end process (logged) | ✅ |
| **Registry cleaner** — orphaned uninstall entries, auto-backed-up & revertible | ✅ |
| **Power plan tuner** — list & switch Windows power plans (revertible) | ✅ |
| **Scheduled task auditor** — flags shady auto-start tasks | ✅ |
| **Boot time tracker** — real boot duration from the event log, trended over samples | ✅ |
| **Browser extension auditor** — Chrome/Edge/Brave/Firefox, flags unknown-sourced | ✅ |
| **Default app manager** — reset hijacked file associations (backup + revert) | ✅ |
| **Driver inventory** — pnputil enumeration (read-only) | ✅ |
| **Storage liberation** — storage radar, biggest files, Recycle Bin size/empty, Windows.old, swap files, big-dupe groups | ✅ |
| **Scheduled maintenance** — one-click junk + duplicate + storage sweep, dated reports | ✅ |

## Organize, security & network

| Feature | Status |
|---|---|
| **Duplicate finder** — hash-based, staging trash (reversible), permanent empty | ✅ |
| **Auto-sort** — rule-based filing by type or date, preview-first, reversible | ✅ |
| **Storage visualizer / smart folders / archiver / batch rename / screenshot organizer / downloads auto-expiry / unused-app flagging / cross-cloud duplicate finder** | ✅ |
| **Security sweep** — read-only audit: telemetry, startup risk, Wi-Fi, firewall, bloatware | ✅ |
| **Permission auditor** — per-app mic/camera/location with global kill-switch (revertible) | ✅ |
| **Browser privacy hardening** — one-click policies for Chrome/Edge, revertible | ✅ |
| **USB device history** — read-only view of USBSTOR | ✅ |
| **Windows Security Center** — health status, quick/full scans, threats (restore/remove), Controlled Folder Access, ASR rules, autorun threat surface, definitions update | ✅ |
| **Clipboard manager** — live history, search, pin, clear (local-only) | ✅ |
| **Quick launcher** — every Start-Menu app, one click away | ✅ |
| **Automation macros** — "when app X starts → apply look Y" | ✅ |
| **Focus mode** — hide desktop icons (revertible) | ✅ |
| **Bandwidth hog finder / Wi-Fi cleanup (backup+restore) / network reset / VPN** | ✅ |
| **Game Mode / stream-safe layout / per-game profiles** | ✅ |
| **Displays** — monitor info, per-monitor wallpapers, display profiles save/apply | ✅ |
| **Power** — live battery, plans, screen-off timeout, hibernate | ✅ |

## Core & UX

| Feature | Status |
|---|---|
| **Undo system** — granular per-change log, per-entry revert, versioned snapshots, Factory Fresh | ✅ |
| **History timeline** — grouped by day, time-stamped sessions | ✅ |
| **Health + Personalization scores**, storage-freed & time-saved counters | ✅ |
| **Scheduled automation** — weekly junk, monthly dupes, auto re-apply theme, blue-light schedule | ✅ |
| **Blue light filter** — warm gamma ramp, revertible, restored on launch | ✅ |
| **Accessibility** — simplified mode, UI scaling, color-blind palettes, reduced motion | ✅ |
| **Profile export/import** — `.reforge` JSON bundle | ✅ |
| **Command palette** — Ctrl+K search over views & actions | ✅ |
| **Welcome wizard + 20-20-20 break reminders** | ✅ |
| **Splash screen** — backend config + optional launch-at-login exist; Settings UI on the roadmap | 🟡 |
| **i18n** — English + Spanish dictionaries (full coverage is on the roadmap) | 🟡 |

**Not built yet (planned or honestly out of scope):** boot/login screen skinning
(locked down on Win11 — capability-gated as unsupported), right-click themer,
folder color-coding, context-menu theming, remote pack gallery (local marketplace
ships first), encrypted cloud backup, telemetry (nothing leaves the device today).

## Architecture

```
src/                     React + TS + Tailwind UI (Vite)
  App.tsx                shell: nav, command palette, wizard, error boundary
  views/                 17 views (Dashboard, Makeover, Style Studio, Marketplace,
                         Performance, Tune-up, Organize, Security, Productivity,
                         Displays, Network, Gaming, Power, Accessibility, History,
                         Widgets, Settings)
  components/            shared UI, ScenePreview canvases, style studio, wizard
  features/widgets/      widget hub + registry + runtime
  lib/api.ts             typed command wrappers; in-browser mock backend for preview
  lib/types.ts           shared types for all 263 commands
  lib/                   events, formatting, session store, share codes, style apply/remix
  i18n/                  en.json, es.json
src-tauri/               Rust backend (Tauri 2) — 57 modules, 263 commands
  wallpaper_engine.rs    animated wallpaper window (WebView2 canvas scenes, battery monitor)
  wallpaper_video.rs     video wallpaper window (WorkerW) · transcode.rs  ffmpeg pipeline
  wallpaper_static.rs    slideshow rotation + history · wallpaper.rs  SPI + IDesktopWallpaper
  widgets.rs             desktop widget windows (clock/stats/note/todo/calendar)
  theme.rs / styles.rs / packs.rs / cursors.rs / palette.rs   look & feel
  sounds.rs              sound schemes · fonts.rs  font install/substitute
  shell.rs               taskbar redesign (pending-restart orchestrator)
  lockscreen.rs          lock-screen image/slideshow/spotlight
  screensaver.rs         screensaver registration + fullscreen scene mode
  rgb.rs                 OpenRGB lighting (TCP SDK protocol)
  marketplace.rs         local .reforgepack bundles
  security_center.rs     Windows Security Center (Defender, threats, CFA, ASR)
  security.rs            audit + permissions + browser policies + USB history
  cleanup.rs / startup.rs / tuneup.rs   junk, startup, bloatware, plans, tasks, boot
  files.rs / duplicates.rs / organize.rs / storage.rs / saves.rs   organize & storage
  productivity.rs / network.rs / gaming.rs / displays.rs / power.rs / perf.rs
  automation.rs          schedules + blue-light · maintenance.rs  reports
  dashboard.rs / system.rs   scores + health · fun/  overlay widgets & achievements
  undo.rs                granular undo log, versioned snapshots, factory-fresh restore
  migrations.rs / restore.rs / state.rs / storage.rs   versioned state + boot restore
  capability.rs          OS capability matrix + elevation · splash.rs  splash config
  updater.rs             sha256-verified update pipeline · cmd.rs / error.rs  infra
```

All state (settings, undo log, snapshots, generated wallpapers, clipboard history,
widgets, macros, schedules) lives in the app data directory
(`%APPDATA%\com.reforge.app`) as versioned JSON with a migration system.
Local-first: nothing leaves the device without explicit opt-in.

## Prerequisites

- [Rust](https://rustup.rs) (stable toolchain, MSVC target)
- MSVC C++ Build Tools + Windows SDK
- Node.js 20+ and npm
- WebView2 runtime (preinstalled on Windows 10/11)

## Build & run

```bash
npm install

# dev (opens the app window):
npm run tauri dev

# or preview the UI in a browser against the mock backend:
npm run dev            # http://localhost:1420

# typecheck + production frontend build:
npm run build

# production exe + installers:
npm run tauri build

# cargo commands need the MSVC environment — run them from a Visual Studio
# developer prompt:
cargo check
cargo test
cargo clippy -- -D warnings
```

> The Rust backend is only compiled for Windows targets — it uses the `windows`
> crate, registry access, and COM interfaces directly.

## Testing

```bash
npm test                # 35 frontend test files (vitest)
cargo test              # 116 Rust unit tests (MSVC env required)
npm run lint            # eslint, zero warnings
npm run test:a11y       # 4px grid, clipping, focus-visible, contrast checks
```

## Safety model

- Every mutating command records a revertible undo entry *before* it changes anything.
- Cleanup runs dry-run first; deletion only ever touches whitelisted temp/cache dirs.
- Startup disablement moves values to the undo log (HKCU/HKLM) or a `.reforge_disabled`
  folder, never deletes blindly.
- Registry cleanups and Wi-Fi forgets keep backups that History can restore.
- "Factory Fresh" restores the earliest snapshot captured before a makeover session.
- Long operations (scans, transcodes) run off the main thread and emit progress events.
- Every command returns a typed `Result<T, AppError>`; inputs are validated Rust-side
  before touching the filesystem, registry, or a shell.

## Roadmap

The plan to v1.0 — 7 phases, from "ship the truth" to "scale", with file-level
work items and a prioritized backlog — lives in
**[docs/ROADMAP.md](docs/ROADMAP.md)**. Delivery decisions (unsigned-by-decision
posture, startup handoff, exe size) are recorded in
[docs/DELIVERY.md](docs/DELIVERY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for build instructions, testing, and pull request guidelines.

## License

Released under the [GNU GPL-3.0](LICENSE). See `THIRD_PARTY_NOTICES.md` for the
bundled third-party components.
