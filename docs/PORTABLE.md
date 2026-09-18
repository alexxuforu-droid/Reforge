# Portable mode (USB-stick Reforge)

Reforge already runs without an installer: the release exe only needs the
**ffmpeg sidecar** sitting next to it. That's the whole story — no registry
installation, no services, no admin requirement for most features.

## What you get

Every release ships a `Reforge_portable_win_x64.zip` containing:

```
reforge.exe          the app
ffmpeg.exe           media normalization (videos/GIFs) — optional but recommended
```

## How to use it

1. Download `Reforge_portable_win_x64.zip` from the latest release.
2. Extract both files into one folder — anywhere, including a USB stick.
3. Run `reforge.exe`.

That's it. Settings, undo history, snapshots, packs, and imported media are
stored in `%APPDATA%\com.reforge.app`, so a USB stick holds the *program* and
each PC keeps its own *data*. Copying the zip to a new machine gives you the
same app there.

## What portable does *not* change

- **Data location** — app data still lives in `%APPDATA%` (same as the
  installed version). This is deliberate: portable mode is about the program,
  not a roaming profile. If you want a fully self-contained profile, use
  `%APPDATA%\com.reforge.app` symlinks (out of scope).
- **Elevation** — features that need admin (font swapping, some lock-screen
  work) still prompt via the "Relaunch as administrator" flow.
- **Updates** — the built-in updater replaces the exe in place. On a read-only
  USB stick that will fail; run from a writable location if you want in-app
  updates, or just re-download the zip.

## Which artifacts do what

| Artifact                | Use when                                  |
| ----------------------- | ----------------------------------------- |
| `*-setup.exe` (NSIS)    | Installing the app normally (default)     |
| `*.msi`                 | Enterprise / group-policy deployments     |
| `Reforge_portable_win_x64.zip` | USB stick, no-install, or isolated runs |
| `reforge.exe` (raw)     | Developers; needs `ffmpeg.exe` next to it |
