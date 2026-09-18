# Changelog

## 1.0.0 — 2026-09-18

First full release. Every change the app makes stays reversible from History.

- **Makeover journeys**: guided Protect → Scan → Clean → Style → Done flow, style quiz, per-monitor video wallpapers, RGB restore-on-exit.
- **Marketplace**: install/apply/revert look packs as one undoable change, 20-char offline share codes.
- **Trust & safety**: granular undo log (capped, versioned snapshots, Factory Fresh), dry-run-first cleanup, staging trash, backups before registry/Wi-Fi changes.
- **Security Center**: Defender health, scans, threats, Controlled Folder Access, ASR rules, exclusions, real-time-protection pause with auto-restore.
- **Reliability**: 144 Rust tests, 10 green browser journeys, `test:e2e` gate, three locales (English/Español/Deutsch) with a hardcoded-string ratchet.
- **Power users**: CLI flags (`--version`, `--help`, `/s`), read-only config inventory + registry view in Settings → Advanced, diagnostics bundle.
- Releases are **unsigned by decision** — Windows may show "Unknown publisher" on first run. Local-first: nothing leaves the device.
