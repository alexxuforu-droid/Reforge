# Delivery & Platform — S12

This file records the delivery decisions the plan asked
to be **documented, not just implemented**:

1. SmartScreen reality — **unsigned by decision** (S12.2)
2. Splash → main handoff timing contract (S12.6)
3. Exe size decision (S12.7)
4. Telemetry — **fully local by decision** (P3-8)

The updater (S12.1), installer UX (S12.4), versioned state + migrations (S12.5)
and the GitHub Actions pipeline (S12.3) are implemented in code — see
`src-tauri/src/updater.rs`, `src-tauri/src/migrations.rs`,
`src-tauri/tauri.conf.json`, `.github/workflows/release.yml`.

---

## 1. SmartScreen — UNSIGNED BY DECISION (S12.2)

**Decision (owner, 2026-08-16): Reforge ships unsigned, permanently.** No
code-signing certificate will be purchased and no third-party signing service
(SignPath or otherwise) will be used. The old signing scripts
(`scripts/sign-release.ps1`, `scripts/make-dev-cert.ps1`) and the CI signing
step have been **removed** — this is a product decision, not a deferred task,
and nothing in the repo should resurrect it without a deliberate reversal.

**What this means for users:** Windows SmartScreen shows "Windows protected
your PC — an unrecognized app is trying to run" on machines that have not
already run the exe. This is expected, documented in the README, and stated
in-app (Settings → About) so nobody is surprised.

**How trust builds anyway:**

- **SmartScreen reputation.** A binary that has been downloaded a lot on real
  Windows machines builds download reputation and the warning fades over time.
  This is exactly why the updater matters: shipping frequent updates through
  one stable exe builds reputation far faster than scattering one-off
  downloads across the internet.

**What does NOT clear SmartScreen:**

- Self-signed certs (dev only).
- Adding the exe to your own "trusted publishers" store (only helps your machine).
- Renaming, recompressing, or re-hashing the file (SmartScreen tracks content).

The pipeline never pretends otherwise: installer, README, and in-app copy all
say "unsigned by decision".

---

## 2. Splash → main handoff (S12.6)

The splash is **not a loading screen for a blocked main thread**. The event loop
starts immediately; everything that could block is deferred to a background
thread 1.5 s after setup:

```
t+0.0s   setup(): data dirs, migrations (versioned state), mica, fun-widgets
t+0.0s   background threads spawn (clipboard, macros, engine, rotation, …)
t+1.5s   deferred thread: shell safe-mode fallback → restore plan →
         main-thread restore (engine + widgets + automation state) → splash
t+~2s    deferred thread logs "done in Nms"
```

**Timing contract:** every deferred step logs its elapsed time to
`startup.log` (`deferred startup: begin`, `restoring UI layers on main thread`,
`deferred startup: done in Nms`). A release-build regression shows up as a jump
in that final number — the check is to run the release exe, launch, and read
`%APPDATA%\com.reforge.app\startup.log`; the handoff should complete in the low
single-digit seconds on a cold start, and the main window must be interactive
*before* the deferred thread finishes (that is the point of deferring).

The splash spawns from within the main-thread restore callback, so it always
appears after the persistent layers are back — never on a blank desktop, never
after the user is already looking at the app.

---

## 4. Telemetry — FULLY LOCAL BY DECISION (P3-8)

**Decision (owner, 2026-08-16): Reforge collects no telemetry. Permanently.**
No anonymous usage counts, no error uploads, no analytics SDK, no crash
reporting service. The local-first posture of the product is also its data
posture: what happens on your machine stays on your machine.

**What users get instead:** a **Diagnostics bundle** (Settings → About →
Bundle) that writes build info + the startup-log tail into a plain `.txt` in
Downloads. If something breaks, the user reads it or attaches it to a GitHub
issue. Nothing is uploaded automatically — the file only leaves the machine
if the user sends it.

**What this means for the roadmap:** any future "metrics" idea (e.g. "how
many people use video wallpapers") is answered with public release/download
counts, not in-app tracking. Revisit only with a deliberate reversal like the
signing decision above.

---

## 3. Exe size decision (S12.7)

**Decision: keep the single-file exe; do not externalize media to AppData at
first run. Revisit if the bundled media grows past ~400 MB.**

| Artifact | Size |
|---|---|
| `reforge.exe` (release, Aug 15 build) | 319.6 MB |
| bundled `ffmpeg.exe` sidecar (video import) | 98 MB |
| `resources/` tree (source of the above) | 99 MB |

**Why keep it single-file:**

- **It already works.** The S1.4 reinstall + S4 desktop checklist prove a
  self-contained exe + one sidecar runs from a USB stick with zero setup. That
  is a real product feature for a "PC makeover" tool.
- **First-run extraction is a UX tax.** Downloading 320 MB *then* unpacking it
  to AppData means the first launch after install does heavy disk I/O and the
  app's state is spread across two directories — worse for uninstall (S12.4
  wipes AppData) and for the "local-first, zero install" story.
- **The size is mostly the bundled Rust binary + ffmpeg**, not user media. User
  wallpapers/scenes already live in `%APPDATA%\com.reforge.app\` (versioned
  state, S12.5). The exe is big because it *ships* capabilities, which is
  exactly what a single-file deliverable should do.

**When to revisit:** if engine scenes or bundled packs push the exe past
~400 MB, externalize the largest assets to a first-run `assets/` seed in
AppData and keep a manifest-hash integrity check (the updater's sha256 pattern
reuses cleanly). Until then the size is a deliberate trade for robustness.

**Downside recorded:** 320 MB is a chunky download for the updater (S12.1). The
pipeline mitigates this with delta-friendly versioning (each release is a full
exe, sha256-verified, NSIS-installed silently) — accepted for now.

---

## 5. Packs 3.0 decision register (P-3)

**Recorded 2026-09-17.** One table, no ambiguity:

| Item | Outcome | Rationale |
|---|---|---|
| Community gallery (P-1) | **Deferred** — build only if packs see real use after launch | Share codes already cover offline sharing; the read-only-repo design (`reforge-gallery` JSON index) stays valid and costs nothing to keep on the shelf. |
| Theme trio generator (P-2) | **Deferred, cut freely** | Content-generation work; capture covers everything today. Reuse the desktop-mock preview canvas if ever built. |
| MSIX packaging | **Declined** unless enterprise demand appears | NSIS per-user installer covers the audience; no Store requirement exists. |
| Cloud backup (X-5) | **Declined** — local-first default stands | Profile + undo history stay on-device; encrypted user-owned-folder sync may be reconsidered only on explicit demand. |

---

## 6. 2026-09-18 security + perf re-verification (X-8/X-9)

- **unwrap sweep: clean.** Every `.unwrap()`/`.expect()` in `src-tauri/src` lives in `#[cfg(test)]` modules, except three justified constants: `"127.0.0.1:6742".parse().unwrap()` (`capability.rs`, constant literal), process-entry `.expect()` in `run()`/`run_screensaver_app()` (`lib.rs`, abort-with-context by design), and the `about:blank` fallback parse (`splash.rs`, constant).
- **shell sweep: clean with two fixes landed.** All PowerShell scripts are fixed constants; Wi-Fi/VPN names pass `validate_profile_name` as single argv elements (VPN gap closed in `network.rs`); threat IDs are validated u64 (`security_center.rs`); elevation path is single-quote-escaped (`capability.rs::ps_single_quote`); pack importer keeps extension + content-sniff + size caps (`marketplace.rs::validate_pack_security`); updater downloads are sha256-verified (`updater.rs::verify_download`).
- **startup handoff: 2ms measured, 8000ms budget — budget unchanged.** The 2ms figure is deferred-startup from the on-disk log (2026-08-16); a true cold-start number needs a headed machine, so no tightening without that measurement.
- **Rust gate at audit time:** `cargo fmt --check` clean · `cargo clippy --all-targets -- -D warnings` clean · `cargo test` 144/144 green.

---

## 7. 2026-09-20 security + perf re-verification (X-8/X-9)

- unwrap sweep: clean — every `.unwrap()`/`.expect()` in `src-tauri/src` outside `#[cfg(test)]` modules is one of the three previously justified constants (constant socket-addr parse in `capability.rs:129`, process-entry `.expect()` in `lib.rs:run()`/`run_screensaver_app()`, `about:blank` fallback in `splash.rs:129`); all other hits are test-module code (serde roundtrips, temp-dir fixtures, validator assertions).
- shell sweep: clean, no new call sites — PowerShell scripts remain fixed constants; Wi-Fi/VPN names flow through `validate_profile_name` (single argv, `network.rs:144,350,372`), threat IDs through `validate_threat_id` (`security_center.rs:577,593,624`), elevation path through `ps_single_quote` (`capability.rs:208`); updater transport is fixed-arg `curl.exe` with sha256 verification (`updater.rs:verify_download`).
- startup handoff: 2ms (budget 8000ms) — budget unchanged; the on-disk log is stale (2026-08-16, headless machine, no fresh launch possible), so no tightening without a cold-start measurement.
- pack importer: extension + content-sniff + size caps verified in `marketplace.rs:validate_pack_security`
