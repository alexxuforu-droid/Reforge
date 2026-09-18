# PC Makeover App — Product Spec (Draft v0.1)

> Status: Pre-development plan. Written to be ready for the full implementation prompt.
> Platform: **Windows only** (Windows 10 & 11). Personal tool first; sharing optional later.

---

## 1. Product Overview

A Windows desktop utility with two missions in one app:

1. **Makeover** — restyle the look & feel of Windows (wallpaper, theme, accent color,
   dark/light mode, taskbar, icons, cursors, sounds, lock screen) via one-click
   "look" packs, with live previews and one-click revert.
2. **Tune-up** — clean up and optimize the PC (temp files, junk cleanup, startup
   manager, resource info, safe registry / privacy toggles).

Personal tool first ("make my PC look awesome + run better"). If the pack system
works well, add import/export for sharing packs.

## 2. Guiding Principles

- **Safety first**: every change is reversible. Backup snapshot before any apply;
  one-click full revert.
- **Previews before applying**: see the look before it touches the system.
- **Dry-runs for cleanup**: cleanup shows what it *will* delete before deleting.
- **Windows-native where it matters**: use official Windows APIs, never hacky
  third-party patches (no uxstyle-style DLL injection).
- **Fast & light**: small binary, low RAM, quick startup (desktop app with shortcut).

## 3. Architecture

### 3.1 Shell: Tauri 2 + React + Rust

| Layer | Tech | Why |
|---|---|---|
| Frontend UI | React + TypeScript (Vite) | Fast to build a polished UI; rich preview rendering |
| Backend | Rust (Tauri commands) | Direct Windows API access, small binary, safe |
| Windows API access | `windows` crate (Win32/COM bindings) | Official APIs, no PowerShell string hacks |
| Styling | Tailwind CSS (or similar) | Rapid, consistent theming |
| Build | Tauri bundler | Single portable `.exe` / MSI, NSIS installer |

### 3.2 Process model

- Main window: dashboard with two tabs — **Makeover** and **Tune-up**.
- A **background service/worker** (Tauri sidecar or Rust thread) for long cleanup
  scans and slideshow wallpaper rotation.
- **Elevation**: most personalization is per-user (no admin needed). Only
  system-wide operations (system theme install, boot-level changes) request
  elevation via a clean "Run as admin" flow, and only when required.

### 3.3 Data & persistence

- App settings: JSON at `%APPDATA%\pc-makeover\settings.json`.
- **Snapshot store**: `%APPDATA%\pc-makeover\snapshots\` — a manifest + copies of
  prior settings (registry export, wallpaper paths, current theme, etc.) so any
  applied look can be reverted exactly.
- **Pack files**: a single archive (`.zip`-based, e.g. `.pcmk`) containing:
  - `manifest.json` — pack metadata (name, version, author, description, thumbnail)
  - `wallpaper.*` — image(s)
  - `theme.theme` — Windows theme file (INI) when included
  - `icons/`, `cursors/`, `sounds/` — optional bundled assets
  - `preview.png` — screenshot mockup of the look
- **Pack store (local)**: `%APPDATA%\pc-makeover\packs\` — installed packs.

## 4. Feature Spec

### 4.1 Makeover Engine

**Wallpapers**
- Set wallpaper from local image or built-in gallery
- Per-monitor wallpaper (via `IDesktopWallpaper` COM interface)
- Slideshow / rotation with interval
- Wallpaper sources: local, folder watch, online (Unsplash/Bing) — *later phase*

**Theme & personalization**
- Apply accent color, dark/light mode (registry `HKCU\...\Personalize`)
- Apply `.theme` files (parsed INI) and system theme
- Taskbar styling where supported (transparency, color, position)
- Lock screen image
- Sound scheme swap

**Icon & cursor packs**
- Apply cursor sets (registry `HKCU\Control Panel\Cursors`)
- Icon pack application via desktop icon cache rebuild (careful, risky area)

**"Look" packs (core differentiator)**
- One-click apply of a complete look: wallpaper + accent + mode + taskbar + sounds + cursors
- Snapshot-before-apply; one-click revert
- Pack manager: install, list, delete, export/import

**Preview**
- Mockup canvas: renders a stylized desktop with chosen wallpaper, accent color,
  mode, and taskbar so the user sees the look before applying
- Thumbnails for packs (generated from preview render)

### 4.2 Tune-up Engine

- **Junk cleanup**: temp folders (`%TEMP%`, `C:\Windows\Temp`), recycle bin,
  browser caches, old Windows update leftovers — dry-run first, size display,
  safe-list exclusions
- **Startup manager**: list & toggle startup entries (registry Run keys +
  `shell:startup` folder + Task Scheduler), show impact/risk
- **Disk/space insights**: largest folders/files, space by category
- **Privacy/UX toggles**: telemetry-ish settings, suggested tweaks (with clear
  "what this does" text)
- **System info**: clean display of CPU/RAM/disk/OS/GPU

### 4.3 Safety system (cross-cutting)

- Every destructive or system-mutating action: confirm dialog with clear copy
- Cleanup: dry-run preview list → explicit confirm
- Makeover: auto-snapshot → apply → "Undo" toast with easy restore
- Log file at `%APPDATA%\pc-makeover\logs\` for debugging
- All registry edits scoped to `HKCU` where possible; never delete keys blindly

## 5. Windows API / Integration Inventory

| Capability | API / mechanism |
|---|---|
| Per-monitor wallpaper | `IDesktopWallpaper` (COM) |
| Single wallpaper / basic | `SystemParametersInfo(SPI_SETDESKWALLPAPER)` |
| Accent color, dark/light, taskbar | Registry: `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` (and `Themes\` for taskbar/transparency) |
| Theme files | Parse/write `.theme` (INI format); `SystemParametersInfo(SPI_SETDESKWALLPAPER)` + notify |
| Lock screen | Registry `HKCU\...\Personalize\LockScreenImage` |
| Cursors | Registry `HKCU\Control Panel\Cursors` + `SystemParametersInfo(SPI_SETCURSORS)` |
| Sounds | Registry `HKCU\AppEvents\Schemes` |
| Startup entries | Registry `HKCU\...\Run`, `HKLM\...\Run`, `shell:startup` folder, Task Scheduler (COM) |
| Temp/junk locations | Known folders + `SHGetKnownFolderPath` |
| OS/hardware info | Win32 APIs (`GetSystemInfo`, `GlobalMemoryStatusEx`, WMI via `windows` crate) |
| Recycle bin | `SHQueryRecycleBin` / `SHEmptyRecycleBin` (with confirm) |
| Elevation | UAC manifest / `ShellExecuteW(runas)` for admin-only ops |

## 6. Data Model Sketch

```jsonc
// settings.json
{
  "version": 1,
  "activeLook": { "packId": "midnight-rain", "appliedAt": "..." },
  "preferences": { "previewQuality": "high", "slideshowIntervalMin": 30 }
}

// pack manifest.json
{
  "id": "midnight-rain",
  "name": "Midnight Rain",
  "version": "1.0.0",
  "author": "me",
  "description": "Dark blue accents, deep wallpaper, rounded taskbar feel",
  "preview": "preview.png",
  "wallpaper": ["wallpaper.jpg"],         // per-monitor list
  "theme": "midnight.theme",              // optional
  "accent": "#4A6CF7",
  "mode": "dark",                          // dark | light | system
  "taskbar": { "transparency": 0.8, "color": "#111827" },
  "cursors": "cursors/",                   // optional dir
  "sounds": "sounds/",                     // optional scheme dir
  "lockScreen": "lock.jpg"                 // optional
}

// snapshot manifest.json
{
  "id": "snap-2026-08-10T12-00-00Z",
  "lookId": "midnight-rain",
  "captured": { "wallpapers": [...], "accent": "...", "mode": "...",
                "themePath": "...", "registryExports": {...} }
}
```

## 7. UI Sketch

```
┌────────────────────────────────────────────────────────────┐
│  PC Makeover                      [Makeover] [Tune-up]     │
├────────────────────────────────────────────────────────────┤
│  ┌ Preview canvas ──────────────┐  ┌ Look packs ─────────┐ │
│  │ (mockup desktop w/ chosen    │  │  ▣ Midnight Rain    │ │
│  │  look; live sliders for      │  │  ▣ Sunset Boulevard │ │
│  │  accent/mode/taskbar)        │  │  ▣ + Import pack    │ │
│  └──────────────────────────────┘  └─────────────────────┘ │
│  [ Apply look ]  [ Undo last change ]                      │
└────────────────────────────────────────────────────────────┘
```

- Makeover tab: preview canvas left, pack gallery right, "Apply"/"Undo" bar bottom.
- Tune-up tab: scan button → results list with sizes + checkboxes → "Clean selected".
- Toast notifications for applied/undone changes.

## 8. Phased Build Plan

**Phase 0 — Scaffold**: Tauri 2 + React + TS project, window opens, settings store,
basic layout (tabs). *(Goal: runnable app skeleton.)*

**Phase 1 — Core makeover**: set wallpaper (single + per-monitor), accent color,
dark/light mode, taskbar transparency. Snapshot + revert for these. *(Goal: first
real "makeover" works end-to-end.)*

**Phase 2 — Look packs**: pack format + manager, one-click apply of combined looks,
preview canvas, import/export. *(Goal: the differentiator works.)*

**Phase 3 — Tune-up**: junk scanner with dry-run, startup manager, disk insights,
safe toggles. *(Goal: cleanup half.)*

**Phase 4 — Polish**: cursors/sounds/lock screen, slideshow, icon packs,
system info, logging, error handling, installer.

**Phase 5 — Sharing (optional)**: pack gallery/import from URL, thumbnails,
versioning. *(Only if the personal tool proves good.)*

## 9. Open Questions / Risks

- Windows 11 vs 10 differences in theming (taskbar transparency is locked down in
  Win11 — may need compromise or third-party tooling; flag early).
- Icon pack changes require icon cache rebuild + Explorer restart — decide if worth it.
- Admin elevation UX: keep per-user scope so most flows never prompt.
- Tauri 2 + `windows` crate: confirm Rust toolchain requirements on the dev machine.
- WebView2 runtime presence on target machines (Tauri requirement).

## 10. Deliverables on First Implementation Pass

1. Scaffolded Tauri 2 + React project in this workspace, runnable via a script.
2. Phase 1 feature set working end-to-end with snapshot/revert.
3. Pack format + manager + preview canvas.
4. Tune-up scanner with dry-run.

## 11. Build Status — SUPERSEDED (updated 2026-08-16)

> This status section dates from the original build passes (2026-08-10) and is
> no longer accurate. The authoritative, audited picture of what's built lives
> in **README.md** (17 sections, 263 commands, 116 Rust tests, 35 frontend
> test files), and the forward plan lives in **docs/ROADMAP.md**. The stale
> lists below were removed so they can't contradict the code.

**What the audit (2026-08-16) found the spec-era "not built" items actually
are today:**

| Spec-era "not built" | Today |
|---|---|
| video/GIF wallpaper files | ✅ built (`transcode.rs` ffmpeg pipeline + `wallpaper_video.rs`) |
| sound/font packs | ✅ built (`sounds.rs` schemes, `fonts.rs` install/substitute) |
| taskbar redesign | ✅ built (`shell.rs` pending-restart orchestrator) |
| lock-screen redesign | ✅ built (`lockscreen.rs` image/slideshow/spotlight) |
| screensaver studio | ✅ built (`screensaver.rs` registers the app as the screensaver) |
| RGB sync | ✅ built (`rgb.rs` via the OpenRGB protocol) |
| marketplace | ✅ built (local `.reforgepack` bundles + Marketplace view) |
| boot/login skinning | ❌ intentionally not built (locked down on Win11; capability-gated as unsupported) |
| context-menu skinning, folder color-coding | ❌ not built (backlog — roadmap §D) |
| cloud backup | ❌ not built (optional decision — roadmap Phase 6) |

**Also landed since the spec was written:** Windows Security Center integration
(`security_center.rs`, 25 commands), storage liberation (radar, biggest files,
Recycle Bin, Windows.old), a Power view, splash config, the fun-widgets hub
(overlays, achievements, boss key), i18n (en/es), **17 views instead of 12**,
and **263 backend commands instead of ~90**.
