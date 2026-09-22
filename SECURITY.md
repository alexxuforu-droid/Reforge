# Security Policy

## Reporting a vulnerability

Reforge is local-first and open source. If you find a security issue:

- **Do not open a public issue** for anything that could put users at risk
  (e.g. a way a pack or wallpaper could affect other files, or a command
  injection vector).
- Email the maintainer (see `CONTRIBUTING.md` → repository contact) or open a
  **private** GitHub advisory under **Security → Advisories → New draft
  advisory**.
- Include: affected version, steps to reproduce, and impact. You should get an
  acknowledgment within a few days.

## Supported versions

Only the latest release is supported. Security fixes ship with the next
release — there is no LTS line.

## Design posture

Reforge ships **unsigned by decision** (see `docs/DELIVERY.md` §1): no code-
signing certificate, no third-party signing service. Trust builds through
download reputation (SmartScreen), transparency, and the guarantees below.
Windows may show "Unknown publisher" on first run — that is expected, not a
bug.

### Guarantees that matter

- **Packs are data-only, never code.** The pack importer rejects scripts and
  executables by both extension *and* real file header (content sniffing —
  an `.exe` renamed to `.png` is still rejected). Pack media is size-capped
  and checksum-verified.
- **Everything is reversible.** Every state change records a before-snapshot
  in the undo log, revertible from History in one click. Nothing is silently
  written.
- **No network calls without your consent.** The app is local-first; the only
  network touches are the update check (opt-in, off by default) and opening
  explicit user links. No telemetry is transmitted (`docs/DELIVERY.md` §4 —
  fully local by decision; the Settings → About diagnostics bundle is the
  export path).
- **Hostile input is escaped.** Wallpaper scenes, widget content, and font
  names are HTML/JS-context-escaped before they reach a webview
  (`no-slop-standard.md` §5, `src-tauri` unit tests).

## Scope

In scope: the `src-tauri/` backend, `src/` frontend, and the build/update
pipeline (`.github/workflows/`).

Out of scope: bundled third-party binaries (`ffmpeg.exe`), whose security is
the upstream project's responsibility — see `THIRD_PARTY_NOTICES.md`.

## Disclosure

We'll credit reporters in release notes unless anonymity is requested.
