import { useEffect } from "react";
import { call, callWithTimeout, errorCopy } from "../lib/api";
import { fmt } from "../lib/format";
import { useLoad } from "../lib/useLoad";
import type { Pack, ThemeState, EngineState, WallpaperState, TranscodeConfig, FontSubstitution, CapabilityMatrix } from "../lib/types";
import { InlineAlert, Modal, ScenePreview, Section, StatusDot, Toggle, toast } from "../components/ui";
import { BlurReveal } from "../components/motion/BlurReveal";
import { StyleStudioRemix } from "../components/StyleStudioRemix";
import { complement, analogous, triadic, hexToHsl, hslToHex } from "../lib/styleRemix";
import { encodeStyleCode } from "../lib/shareCodes";
import {
  ALL_STYLES,
  STYLE_COUNT,
  STYLE_COLLECTIONS,
  QUIZ,
  getStyle,
  naturalVariantId,
  scoreStyle,
  styleComponents,
  sceneConfigForStyle,
} from "../styles";
import {
  IconPower, IconPlus, IconTrash, IconPause, IconPlay,
  IconStar, IconSearch, IconUpload, IconDownload,
} from "../components/icons";
import { shade, copyText, IMPORT_TIMEOUT_MS } from "./makeover/shared";
import QuickHistory from "./makeover/QuickHistory";
import WallpaperGallery from "./makeover/WallpaperGallery";
import { useMakeoverTheme } from "./makeover/useMakeoverTheme";
import { useCursorSection } from "./makeover/useCursorSection";
import { useStyleStudio } from "./makeover/useStyleStudio";
import { useEngineSection } from "./makeover/useEngineSection";
import { useWidgetSection } from "./makeover/useWidgetSection";
import { useVideoSection } from "./makeover/useVideoSection";
import { useTaskbarSection } from "./makeover/useTaskbarSection";
import { useSoundsSection } from "./makeover/useSoundsSection";
import { useFontsSection } from "./makeover/useFontsSection";
import { useLockScreenSection } from "./makeover/useLockScreenSection";
import { useStaticWallpaper } from "./makeover/useStaticWallpaper";
import { useScreensaverSection } from "./makeover/useScreensaverSection";
import { usePackExport } from "./makeover/usePackExport";

const ACCENT_SUGGESTIONS = [
  "#6D7CFF", "#FF2E88", "#FF7B54", "#34D399",
  "#2E7CF6", "#F59E0B", "#EC4899", "#8B5CF6",
];

const STYLE_CATEGORIES = ["All", ...new Set(ALL_STYLES.map((s) => s.category))];

export default function Makeover() {
  const { theme, setTheme, packs, setPacks, activePack, wpPath, setWpPath, applying, setAccent, setMode, setTransparency, applyPack } = useMakeoverTheme(refresh);
  const { cursorSchemes, cursorSchemesError, refreshCursorSchemes, cursorState, cursorStateError, refreshCursorState, cursorRef, applyCursor } = useCursorSection();
  const { quizOpen, setQuizOpen, quizStep, answers, quizDone, detailStyle, setDetailStyle, animOn, setAnimOn, hoverStyle, setHoverStyle, appliedStyleId, appliedStyleError, refreshAppliedStyle, applyingStyle, favOnly, setFavOnly, styleQuery, setStyleQuery, styleCat, setStyleCat, styleTier, setStyleTier, styleAxis, setStyleAxis, styleCollection, setStyleCollection, importOpen, setImportOpen, importCode, setImportCode, importError, setImportError, analytics, favorites, favoritesError, refreshFavorites, pickQuiz, resetQuiz, quizResults, myStyle, toggleFav, styleFiltered, applyStyle, importSharedStyle } = useStyleStudio(refresh);
  const { engine, engineError, refreshEngine, scenes, scenesError, refreshScenes, moodFilter, setMoodFilter, hoverScene, setHoverScene, engineBusy, studioOpen, setStudioOpen, studio, setStudio, applyScene, stopScene, freezeScene, applyStudio, saveStudioScene, deleteCustomScene, engineRef, loadEngine } = useEngineSection();
  const { widgets, widgetsError, refreshWidgets, widgetsSettings, widgetsRef, boardRef, createWidget, resetWidgetLayout, toggleWidget, saveWidgetsSettings, removeWidget } = useWidgetSection(loadEngine);
  const { videoWallpapers, videoError, videoRef, videoPath, setVideoPath, videoBusy, videoPaused, soundImportPath, setSoundImportPath, transcodeNote, videoMonitor, setVideoMonitor, transcode, transcodeError, transcodeCfg, refreshTranscodeCfg, refreshVideo, setVideoWallpaper, stopVideoWallpaper, toggleVideoPaused } = useVideoSection(refreshEngine);
  const { taskbar, taskbarError, pendingShell, pendingError, taskbarCaps, taskbarCapsError, taskbarRef, refreshTaskbar, setTaskbarSize, setTaskbarAlign, setTaskbarAutohide, setTaskbarColorMatch, setTaskbarPosition, applyPendingRestart, revertPending } = useTaskbarSection();
  const { schemes, schemesError, soundEvents, soundEventsError, soundsRef, schemeName, setSchemeName, refreshSounds, applyScheme, saveScheme, setEventSound, previewSound } = useSoundsSection();
  const { fontSubs, fontSubsError, installedFonts, installedFontsError, fontsRef, fontOriginal, setFontOriginal, fontSubstitute, setFontSubstitute, fontInstallPath, setFontInstallPath, refreshFonts, refreshFontSubs, applyFontSub, installFont, removeFont } = useFontsSection();
  const { lockScreen, lockScreenError, lockRef, lsImagePath, setLsImagePath, lsFolder, setLsFolder, lsInterval, setLsInterval, lsPreview, refreshLockScreen, setLsImage, previewLockScreen, setLsSlideshow, setLsSpotlight, setLsHideApps } = useLockScreenSection();
  const { wallpapers, wallpapersError, refreshWallpapers, slideshow, slideshowError, wpHistory, wpHistoryError, slideshowFolder, setSlideshowFolder, slideshowInterval, setSlideshowInterval, monitorTarget, setMonitorTarget, favInput, setFavInput, refreshSlideshow, saveSlideshow, addFavorite, removeFavorite, skipNow, setWallpaperTarget } = useStaticWallpaper(refresh, refreshVideo, wpPath);
  const { screensaverCfgError, screensaverReg, screensaverRef, screensaverBusy, screensaverSceneId, setScreensaverSceneId, shownSsCfg, screensaverScene, saveScreensaver, previewScreensaver } = useScreensaverSection(scenes);
  const { packBusy, exportScenePack, exportCurrentLook } = usePackExport(engine);
  const { data: caps, error: capsError, refresh: refreshCaps } = useLoad<CapabilityMatrix>("get_capability_matrix");

  function refresh() {
    // Core: everything the first paint and primary sections need. Theme + packs
    // keep their existing toast (not silent), everything else refreshes its
    // useLoad handle (which re-fetches and clears any stale error).
    call<ThemeState>("get_theme_state").then(setTheme).catch(() => toast("Failed to load theme", "err"));
    call<Pack[]>("list_packs").then(setPacks).catch(() => toast("Failed to load packs", "err"));
    refreshWallpapers();
    refreshEngine();
    refreshScenes();
    refreshWidgets();
    refreshVideo();
    refreshTaskbar();
    refreshSlideshow();
    refreshCaps();
    refreshAppliedStyle();
    refreshFavorites();
    // Peripheral: cursor, sounds, fonts, lock screen — fetched after first
    // paint so the view mounts fast (C2.1).
    window.setTimeout(() => {
      refreshCursorSchemes();
      refreshCursorState();
      refreshSounds();
      refreshFonts();
      refreshLockScreen();
    }, 0);
  }

  // Mount: theme + packs are plain calls (not useLoad) — fetch them once
  // here. The eager useLoad sections (wallpapers, scenes, slideshow, history,
  // applied style, favorites, caps, undo log) self-fetch on mount, and the
  // lazy sections fetch when their section first scrolls into view (S7.2) —
  // so a full `refresh()` here would double-fetch everything eager.
  useEffect(() => {
    call<ThemeState>("get_theme_state").then(setTheme).catch(() => toast("Failed to load theme", "err"));
    call<Pack[]>("list_packs").then(setPacks).catch(() => toast("Failed to load packs", "err"));
    // Favorites are a plain call (the mirror seeds first paint) — fetch the
    // durable backend copy once on mount.
    refreshFavorites();
  }, [refreshFavorites, setPacks, setTheme]); // mount-once: all three are stable identities (useCallback + useState setters)

  const bg1 = activePack ? activePack.gradient[0] : theme ? shade(theme.accent_hex, -60) : "#0B1026";
  const bg2 = activePack ? activePack.gradient[1] : theme ? shade(theme.accent_hex, 10) : "#2A3B7C";

  return (
    <div className="space-y-4">
      <header className="page-head">
        <h1 className="page-title">Style Studio</h1>
        <p className="page-subtitle">Pick a look, preview it live, apply it in one click. Everything is undoable.</p>
        <div className="mt-2">
          <button
            className="btn-ghost text-xs"
            disabled={packBusy}
            onClick={exportCurrentLook}
            title="Capture your whole current look — accent, wallpaper, video, scene, sounds, fonts, taskbar — into a shareable .reforgepack"
          >
            <IconDownload size={13} /> {packBusy ? "Capturing…" : "Export current look"}
          </button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        {/* ---- Preview ---- */}
        <div>
          <Section title="Live preview" subtitle="This is what your desktop will feel like">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-strong)]">
              {/* content preview — renders the actual gradient wallpaper */}
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)` }} />
              <div className="absolute left-[8%] top-[14%] h-[38%] w-[42%] rounded-lg border border-white/15 bg-black/25 backdrop-blur-[2px]">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                  <span className="ml-3 h-2 w-16 rounded bg-white/20" />
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="h-2 w-3/4 rounded bg-white/15" />
                  <div className="h-2 w-1/2 rounded bg-[var(--gray-4)]" />
                  <div className="h-2 w-2/3 rounded bg-[var(--gray-4)]" />
                </div>
              </div>
              <div className="absolute right-[7%] top-[26%] h-[26%] w-[28%] rounded-lg border border-white/15 bg-black/20">
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                </div>
              </div>
              <div
                className="absolute bottom-0 left-0 right-0 flex h-10 items-center gap-2 border-t border-white/10 px-3"
                style={{
                  background: theme?.transparency ? "rgba(10,12,20,0.55)" : "rgba(10,12,20,0.95)",
                  backdropFilter: theme?.transparency ? "blur(8px)" : "none",
                }}
              >
                <span className="h-4 w-4 rounded-md" style={{ background: theme?.accent_hex ?? "var(--accent-hex)" }} />
                <span className="ml-1 h-4 w-4 rounded-md bg-white/15" />
                <span className="ml-auto text-2xs text-white/60">
                  {theme?.mode === "light" ? "Light" : "Dark"} · {fmt(8.1 * 1024 ** 3)} free
                </span>
              </div>
            </div>
            <p className="mt-3 text-2xs text-[var(--text-tertiary)]">
              {activePack ? `Previewing "${activePack.name}"` : "Tweak the theme controls and packs on the right to preview here."}
            </p>
          </Section>

          {/* ---- Wallpaper ---- */}
          <Section title="Wallpaper" subtitle="Static, slideshow rotation, per-monitor, and history">
            {wallpapersError && <InlineAlert>{wallpapersError}</InlineAlert>}
            {slideshowError && <InlineAlert>{slideshowError}</InlineAlert>}
            {wpHistoryError && <InlineAlert>{wpHistoryError}</InlineAlert>}
            <div className="flex gap-2">
              <input className="input" placeholder="C:\Users\you\Pictures\mountain.jpg" value={wpPath} onChange={(e) => setWpPath(e.target.value)} />
              <button className="btn-primary shrink-0" onClick={setWallpaperTarget} disabled={!wpPath.trim()}>Set wallpaper</button>
            </div>
            {wallpapers && wallpapers.monitors.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-2xs text-[var(--text-tertiary)]">Apply to:</span>
                <select value={monitorTarget} onChange={(e) => setMonitorTarget(e.target.value)}>
                  <option value="">All monitors</option>
                  {wallpapers.monitors.map((m) => (<option key={m.id} value={m.id}>{m.id}</option>))}
                </select>
              </div>
            )}

            {/* Wallpaper Gallery */}
            <WallpaperGallery
              onApply={async (publicPath, type) => {
                setWpPath(publicPath);
                if (type === "live") {
                  callWithTimeout<EngineState>("set_video_wallpaper", { source: publicPath, monitor: videoMonitor || undefined }, IMPORT_TIMEOUT_MS)
                    .then((eng) => { refresh(); refreshVideo(); toast(`Now playing: ${eng.media?.name ?? "video"}`); })
                    .catch((e) => toast(errorCopy(e), "err"));
                } else {
                  call<WallpaperState>("set_wallpaper", { path: publicPath }).then(() => { refresh(); refreshSlideshow(); toast("Wallpaper applied"); }).catch((e) => toast(errorCopy(e), "err"));
                }
              }}
              onStyle={(w) => setDetailStyle(getStyle(naturalVariantId(w)) ?? null)}
            />

            {/* Slideshow */}
            <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">Slideshow rotation</div>
                  <div className="text-2xs text-[var(--text-tertiary)]">Rotate wallpapers from a folder on an interval</div>
                </div>
                <Toggle on={slideshow?.enabled ?? false} onChange={(v) => saveSlideshow({ enabled: v })} />
              </div>
              <div className="space-y-2">
                <input className="input" placeholder="C:\Users\you\Pictures\Wallpapers" value={slideshowFolder} onChange={(e) => setSlideshowFolder(e.target.value)} />
                <div className="flex items-center gap-3">
                  <span className="text-2xs text-[var(--text-tertiary)]">Every</span>
                  <select value={slideshowInterval} onChange={(e) => setSlideshowInterval(Number(e.target.value))}>
                    {[5, 10, 30, 60, 180, 360, 720, 1440].map((m) => (<option key={m} value={m}>{m} min</option>))}
                  </select>
                  <button className="btn-ghost btn-sm" onClick={() => saveSlideshow({})}>Apply</button>
                  <Toggle on={slideshow?.shuffle ?? false} onChange={(v) => saveSlideshow({ shuffle: v })} />
                  <span className="text-2xs text-[var(--text-tertiary)]">shuffle</span>
                </div>

                {/* S11.5 — smart slideshow: skip-now, day/night, favorites */}
                <div className="mt-2 flex items-center gap-3">
                  <button className="btn-ghost btn-sm" onClick={skipNow} disabled={!slideshow?.enabled}>
                    Skip now
                  </button>
                  <Toggle on={slideshow?.day_night_filter ?? false} onChange={(v) => saveSlideshow({ day_night_filter: v })} label="Day/night filter" />
                  <span className="text-2xs text-[var(--text-tertiary)]">
                    day/night{slideshow?.day_night_filter ? " (night prefers moon/dark/star-named images)" : ""}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="mb-1 text-2xs text-[var(--text-tertiary)]">Favorites — picked 3× more often</div>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="C:\Users\you\Pictures\Wallpapers\moon.jpg"
                      value={favInput}
                      onChange={(e) => setFavInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addFavorite(); }}
                      aria-label="Favorite wallpaper path"
                    />
                    <button className="btn-ghost btn-sm" onClick={addFavorite} disabled={!favInput.trim()}>Add</button>
                  </div>
                  {(slideshow?.favorites ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(slideshow?.favorites ?? []).map((f) => (
                        <span key={f} className="inline-flex max-w-full items-center gap-1.5 rounded bg-[var(--surface-raised)] px-2 py-0.5 text-2xs text-[var(--text-secondary)]">
                          <span className="truncate" title={f}>{f}</span>
                          <button onClick={() => removeFavorite(f)} className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--status-danger)]" aria-label={`Remove favorite ${f}`}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recently used */}
            {(wpHistory ?? []).length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Recently used</div>
                <div className="space-y-1">
                  {(wpHistory ?? []).slice(0, 6).map((h) => (
                    <div key={`${h.ts}-${h.path}`} className="flex items-center gap-2 rounded-lg bg-[var(--surface-overlay)] px-3 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-2xs text-[var(--text-secondary)]" title={h.path}>{h.path}</span>
                      {h.monitor_id && <span className="shrink-0 text-2xs text-[var(--text-tertiary)]">{h.monitor_id}</span>}
                      <button className="shrink-0 text-2xs text-[var(--text-secondary)] hover:underline" onClick={() => call<WallpaperState>("set_wallpaper", { path: h.path }).then(() => { refresh(); refreshSlideshow(); toast("Wallpaper restored"); }).catch((e) => toast(errorCopy(e), "err"))}>
                        Use again
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* ---- Controls ---- */}
        <div className="space-y-4">
          {/* Theme Studio */}
          <Section title="Theme Studio" subtitle="Instant, reversible tweaks" actions={<button className="btn-ghost shrink-0 text-xs" onClick={() => { resetQuiz(); setQuizOpen(true); }}>Style quiz</button>}>
            <div className="mb-4">
              <span className="label">App mode</span>
              <div className="segment">
                <button className={`segment-btn ${theme?.mode === "dark" ? "active" : ""}`} onClick={() => setMode("dark")}>Dark</button>
                <button className={`segment-btn ${theme?.mode === "light" ? "active" : ""}`} onClick={() => setMode("light")}>Light</button>
              </div>
            </div>
            <div className="mb-4">
              <span className="label">Accent color</span>
              <div className="mb-2 grid grid-cols-8 gap-2">
                {ACCENT_SUGGESTIONS.map((c) => (
                  <button key={c} onClick={() => setAccent(c)} className={`aspect-square rounded-lg transition hover:scale-105 ${theme?.accent_hex.toLowerCase() === c.toLowerCase() ? "ring-2 ring-[var(--accent-hex)] ring-offset-2 ring-offset-white" : ""}`} style={{ background: c }} aria-label={c} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-2xs text-[var(--text-tertiary)]">Custom:</label>
                <input type="color" value={theme?.accent_hex ?? "var(--accent-hex)"} onChange={(e) => setAccent(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent" />
                <span className="font-mono text-2xs text-[var(--text-tertiary)]">{theme?.accent_hex ?? "#818cf8"}</span>
              </div>
            </div>

            {/* Color harmonics */}
            {theme?.accent_hex && (
              <div className="mb-3">
                <span className="label">Color Harmonics</span>
                <div className="space-y-1.5">
                  <div>
                    <span className="text-2xs text-[var(--text-tertiary)]">Complementary</span>
                    <div className="flex gap-1 mt-0.5">
                      <button onClick={() => setAccent(theme.accent_hex)} className="h-5 w-5 rounded-sm transition hover:scale-110" style={{ background: theme.accent_hex }} />
                      <button onClick={() => setAccent(complement(theme.accent_hex))} className="h-5 w-5 rounded-sm transition hover:scale-110" style={{ background: complement(theme.accent_hex) }} />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xs text-[var(--text-tertiary)]">Analogous</span>
                    <div className="flex gap-1 mt-0.5">
                      {[analogous(theme.accent_hex, -30), theme.accent_hex, analogous(theme.accent_hex, 30)].map((c, i) => (
                        <button key={i} onClick={() => setAccent(c)} className="h-5 w-5 rounded-sm transition hover:scale-110" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-2xs text-[var(--text-tertiary)]">Triadic</span>
                    <div className="flex gap-1 mt-0.5">
                      {[theme.accent_hex, triadic(theme.accent_hex, 120), triadic(theme.accent_hex, 240)].map((c, i) => (
                        <button key={i} onClick={() => setAccent(c)} className="h-5 w-5 rounded-sm transition hover:scale-110" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-[var(--text-secondary)]">Translucent taskbar</div>
                <div className="text-2xs text-[var(--text-tertiary)]">Windows 11 may restrict this</div>
              </div>
              <Toggle on={theme?.transparency ?? true} onChange={setTransparency} />
            </div>
          </Section>

          {/* Color palette from accent */}
          {theme?.accent_hex && (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-overlay)] p-3">
              <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Accent Palette</div>
              <div className="flex gap-1">
                {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => {
                  const [h, s] = hexToHsl(theme.accent_hex);
                  const lightness = 100 - (shade / 1000) * 80;
                  const saturation = s * (shade < 300 ? 0.6 : shade > 700 ? 0.8 : 1);
                  const c = hslToHex(h, saturation, lightness);
                  return (
                    <button
                      key={shade}
                      onClick={() => setAccent(c)}
                      className="flex-1 h-6 rounded-sm transition hover:scale-y-125"
                      style={{ background: c }}
                      title={`${shade}: ${c}`}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-2xs text-[var(--text-tertiary)]">Current</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: theme.accent_hex }} />
                  <span className="font-mono text-2xs text-[var(--text-secondary)]">{theme.accent_hex}</span>
                </div>
              </div>
            </div>
          )}

          {/* Current theme state summary */}
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-overlay)] p-3">
            <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Current Theme</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-2xs text-[var(--text-tertiary)]">Mode</span>
                <span className="text-2xs font-mono text-[var(--text-secondary)]">{theme?.mode ?? "dark"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xs text-[var(--text-tertiary)]">Transparency</span>
                <span className="text-2xs text-[var(--text-secondary)]">{theme?.transparency ? "On" : "Off"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xs text-[var(--text-tertiary)]">Cursor</span>
                <span className="text-2xs text-[var(--text-secondary)]">{cursorState?.scheme_source?.replace("Reforge:", "") ?? "default"}</span>
              </div>
              {engine?.active && (
                <div className="flex items-center justify-between">
                  <span className="text-2xs text-[var(--text-tertiary)]">Live wallpaper</span>
                  <span className="badge badge-accent">Active</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick undo history */}
          <QuickHistory />

          {/* Cursor */}
      <div ref={cursorRef}>
          <Section title="Cursor scheme" subtitle={cursorState?.scheme_source || "Current: system default"}>
            {cursorSchemesError && <InlineAlert>{cursorSchemesError}</InlineAlert>}
            {cursorStateError && <InlineAlert>{cursorStateError}</InlineAlert>}
            <div className="space-y-2">
              {(cursorSchemes ?? []).map((s) => (
                <button key={s.id} onClick={() => applyCursor(s.id)} className={`w-full rounded-xl border px-4 py-2.5 text-left transition-colors ${cursorState?.scheme_source === `Reforge:${s.id}` ? "border-[var(--border-accent)] bg-[var(--surface-selected)]" : "border-[var(--border-default)] bg-[var(--surface-overlay)] hover:bg-[var(--surface-hover)]"}`}>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{s.name}</div>
                  <div className="text-2xs text-[var(--text-tertiary)]">{s.description}</div>
                </button>
              ))}
            </div>
          </Section>
      </div>

          {/* Style Studio — the Style Engine catalog */}
          <Section title="Style Studio" subtitle={`${STYLE_COUNT.total} complete looks — ${STYLE_COUNT.flagship} flagships, ${STYLE_COUNT.library} library variants, ${STYLE_COUNT.scene} animated scenes`} actions={
            <div className="flex items-center gap-1.5">
              <button className={`btn-ghost shrink-0 text-2xs ${importOpen ? "!border-[var(--border-accent)] !text-[var(--accent-hex)]" : ""}`} onClick={() => setImportOpen((v) => !v)}>Import code</button>
              <button className="btn-ghost shrink-0 text-2xs" onClick={() => { resetQuiz(); setQuizOpen(true); }}>Style quiz</button>
            </div>
          }>
            {appliedStyleError && <InlineAlert>{appliedStyleError}</InlineAlert>}
            {favoritesError && <InlineAlert>{favoritesError}</InlineAlert>}
            {/* S6.7 — most-used looks + honest palette insight (local only) */}
            {analytics.mostUsed.length > 0 && (
              <div className="mb-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-2.5">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Most-used looks</span>
                  <span className="text-2xs text-[var(--text-tertiary)]">local history — never leaves this PC</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.mostUsed.map((m) => {
                    const s = getStyle(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => { if (s) setDetailStyle(s); }}
                        disabled={!s}
                        className={`rounded-full px-2.5 py-1 text-2xs transition-colors ${s ? "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--accent-hex)] border border-[var(--border-default)]" : "cursor-default bg-[var(--surface-overlay)] text-[var(--text-tertiary)] border border-transparent"}`}
                        title={s ? "Open this look" : "This look is no longer in the catalog"}
                      >
                        {m.name} <span className="ml-1 opacity-70">×{m.count}</span>
                      </button>
                    );
                  })}
                </div>
                {analytics.insight && <p className="mt-1.5 text-2xs text-[var(--text-secondary)]">{analytics.insight}</p>}
              </div>
            )}
            {/* S6.5 — import a shared style from a code */}
            {importOpen && (
              <div className="mb-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-2.5">
                <div className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Import a shared style</div>
                <div className="flex gap-1.5">
                  <input
                    className="input flex-1 !text-xs"
                    placeholder="10-character share code (digits + A–Z)"
                    value={importCode}
                    onChange={(e) => { setImportCode(e.target.value); setImportError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") importSharedStyle(); }}
                    spellCheck={false}
                  />
                  <button className="btn-primary btn-sm shrink-0" onClick={importSharedStyle} disabled={!importCode.trim()}>Import</button>
                </div>
                {importError && <p className="mt-1.5 text-2xs text-[var(--status-danger-text)]">{importError}</p>}
              </div>
            )}
            <div className="mb-3 flex gap-2">
              <div className="relative flex-1">
                <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input className="input !pl-8" placeholder="Search styles…" value={styleQuery} onChange={(e) => setStyleQuery(e.target.value)} />
              </div>
              <button
                className={`btn-ghost shrink-0 btn-sm ${favOnly ? "!border-[var(--border-accent)] !text-[var(--accent-hex)]" : ""}`}
                onClick={() => setFavOnly(!favOnly)}
                title="Favorites only"
              >
                <IconStar size={12} className={favOnly ? "fill-[var(--accent-hex)] text-[var(--accent-hex)]" : ""} /> {favorites.length}
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {STYLE_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setStyleCat(c)} className={`rounded-full px-3 py-1 text-2xs transition-colors ${styleCat === c ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>{c}</button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {([["all", "All tiers"], ["flagship", "Flagships"], ["library", "Library"], ["scene", "Scenes"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setStyleTier(k)} className={`rounded-full px-3 py-1 text-2xs transition-colors ${styleTier === k ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>{label}</button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {([["all", "All axes"], ["natural", "Natural"], ["vivid", "Vivid"], ["minimal", "Minimal"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setStyleAxis(k)} className={`rounded-full px-3 py-1 text-2xs transition-colors ${styleAxis === k ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>{label}</button>
              ))}
              <select className="ml-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] px-2 py-1 text-2xs text-[var(--text-secondary)]" value={styleCollection} onChange={(e) => setStyleCollection(e.target.value)}>
                <option value="All">All collections</option>
                {STYLE_COLLECTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {styleFiltered.slice(0, 24).map((s) => (
                <div key={s.id} role="button" tabIndex={0} onClick={() => setDetailStyle(s)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailStyle(s); } }} onMouseEnter={() => setHoverStyle(s.id)} onMouseLeave={() => setHoverStyle((h) => (h === s.id ? null : h))} onFocus={() => setHoverStyle(s.id)} onBlur={() => setHoverStyle((h) => (h === s.id ? null : h))} className={`group relative cursor-pointer overflow-hidden rounded-lg border text-left transition-colors hover:border-[var(--border-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-hex)] ${appliedStyleId === s.id ? "border-[var(--status-success-border)]" : "border-[var(--border-default)]"}`}>
                  {/* C3 content preview — static gradient until hovered, then the style's animated scene plays live */}
                  {hoverStyle === s.id ? (
                    <div className="relative h-14 w-full overflow-hidden">
                      <ScenePreview kind={sceneConfigForStyle(s).kind} colors={sceneConfigForStyle(s).colors} speed={sceneConfigForStyle(s).speed} density={sceneConfigForStyle(s).density} className="h-full w-full" />
                    </div>
                  ) : (
                    // content preview — renders the actual gradient wallpaper
                    <div className="h-14 w-full" style={{ background: `linear-gradient(135deg, ${s.gradient[0]}, ${s.gradient[1]})` }} />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFav(s.id); }}
                    className={`absolute right-1.5 top-1.5 h-6 w-6 rounded-md bg-black/35 p-1 text-white/80 transition-colors hover:text-white ${favorites.includes(s.id) ? "!text-amber-300" : "opacity-0 group-hover:opacity-100"}`}
                    title={favorites.includes(s.id) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <IconStar size={13} className={favorites.includes(s.id) ? "fill-amber-300" : ""} />
                  </button>
                  <div className="p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold text-[var(--text-primary)]" title={s.name}>{s.name}</span>
                      <span className="shrink-0 badge badge-neutral !text-2xs">{s.axis ?? s.tier}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-2xs text-[var(--text-tertiary)]" title={s.tagline}>{s.tagline}</div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.accent_hex }} />
                      <span className="text-2xs uppercase text-[var(--text-tertiary)]">{s.mode}</span>
                      <span className="ml-auto text-2xs font-medium text-[var(--text-secondary)]">
                        {applyingStyle === s.id ? "Applying…" : appliedStyleId === s.id ? "Applied" : "Details"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {styleFiltered.length > 24 && (
              <p className="mt-2 text-2xs text-[var(--text-tertiary)]">Showing 24 of {styleFiltered.length} — use search or filters to narrow.</p>
            )}
            {styleFiltered.length === 0 && (
              <p className="mt-2 text-2xs text-[var(--text-tertiary)]">No styles match those filters.</p>
            )}

            {/* Classic backend packs */}
            {packs.length > 0 && (
              <div className="mt-4 border-t border-[var(--border-default)] pt-3">
                <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Classic packs</div>
                <div className="grid grid-cols-2 gap-2">
                  {packs.map((p) => (
                    <button key={p.id} onClick={() => applyPack(p)} disabled={applying !== null} className={`group overflow-hidden rounded-lg border text-left transition-colors hover:border-[var(--border-accent)] ${activePack?.id === p.id ? "border-[var(--border-accent)]" : "border-[var(--border-default)]"}`}>
                      {/* content preview — renders the actual gradient wallpaper */}
                      <div className="h-14 w-full" style={{ background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})` }} />
                      <div className="p-2">
                        <div className="truncate text-xs font-semibold text-[var(--text-primary)]" title={p.name}>{p.name}</div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.accent_hex }} />
                          <span className="text-2xs font-medium text-[var(--text-secondary)]">{applying === p.id ? "Applying…" : activePack?.id === p.id ? "Applied" : "Apply"}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {packs.length === 0 && (
              <div className="mt-4 border-t border-[var(--border-default)] pt-3">
                <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Classic packs</div>
                <p className="text-xs text-[var(--text-tertiary)]">No packs installed yet — capture your current look in Marketplace and it'll show up here.</p>
              </div>
            )}

            {/* F-C: remix mode — independent wallpaper/accent/mode pickers */}
            <StyleStudioRemix scenes={scenes ?? []} theme={theme} />
          </Section>
        </div>
      </div>

      {/* ---- Animated Wallpaper Engine ---- */}
      <div ref={engineRef}>
      <Section title="Animated Wallpaper Engine" subtitle="Living, breathing desktops — procedural scenes render behind your icons" actions={<div className="flex gap-2"><button className="btn-ghost shrink-0 text-2xs" onClick={() => setStudioOpen(true)}>Wallpaper Studio</button>{engine?.active ? (<><button className="btn-ghost shrink-0 text-2xs" onClick={() => freezeScene(!engine.frozen)}>{engine.frozen ? <><IconPlay size={11} /> Resume</> : <><IconPause size={11} /> Freeze</>}</button><button className="btn-danger shrink-0 text-2xs" disabled={engineBusy} onClick={stopScene}><IconPower size={11} /> Stop</button></>) : (<span className="badge badge-neutral">Not running</span>)}{engine?.scene && (<button className="btn-ghost shrink-0 text-2xs" disabled={packBusy} onClick={exportScenePack} title="Capture this scene (plus your current look) into a shareable pack">{packBusy ? "Capturing…" : "Export scene pack"}</button>)}</div>}>
        {engineError && <InlineAlert>{engineError}</InlineAlert>}
        {scenesError && <InlineAlert>{scenesError}</InlineAlert>}
        {engine?.active && (
          <div className="mb-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success)]">
            <StatusDot status="success" pulse /> {engine.scene?.name ?? "Scene"} is live{engine.frozen ? " (frozen)" : ""}
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {["all", "calm", "energetic", "nature", "space", "seasonal"].map((m) => (
            <button key={m} onClick={() => setMoodFilter(m)} className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${moodFilter === m ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {(scenes ?? []).filter((s) => moodFilter === "all" || s.mood === moodFilter).map((s) => (
            <div key={s.id} onMouseEnter={() => setHoverScene(s.id)} onMouseLeave={() => setHoverScene((h) => (h === s.id ? null : h))} className={`group relative overflow-hidden rounded-xl border text-left transition-colors ${engine?.scene?.id === s.id ? "border-[var(--status-success-border)]" : "border-[var(--border-default)] hover:border-[var(--border-accent)]"}`}>
              <button onClick={() => applyScene(s)} disabled={engineBusy} className="w-full">
                <div className="h-24 w-full overflow-hidden">
                  {hoverScene === s.id ? (
                    <ScenePreview kind={s.kind} colors={s.colors} speed={s.speed} density={s.density} className="h-full w-full" />
                  ) : (
                    // static color story until hovered — zero canvases on load (S7.6, content preview)
                    <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${s.colors[1] ?? s.colors[0]}, ${s.colors[0]})` }} />
                  )}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-xs font-semibold text-[var(--text-primary)]" title={s.name}>{s.name}</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-2xs capitalize text-[var(--text-tertiary)]">{s.kind}</span>
                    {engine?.scene?.id === s.id ? <span className="badge badge-success">LIVE</span> : <span className="text-2xs text-[var(--text-secondary)]">Apply</span>}
                  </div>
                </div>
              </button>
              {s.id.startsWith("custom-") && (
                <button
                  onClick={() => deleteCustomScene(s)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-black/45 p-1 text-white/80 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                  title="Delete custom scene"
                >
                  <IconTrash size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Section>
      </div>

      {/* ---- Screensaver ---- */}
      <div ref={screensaverRef}>
      <Section title="Screensaver" subtitle="Your scenes as a real Windows screensaver — registers SCRNSAVE, opens fullscreen on idle, any input exits" actions={
        <div className="flex gap-2">
          <button className="btn-ghost shrink-0 text-2xs" disabled={screensaverBusy || !shownSsCfg?.enabled} onClick={previewScreensaver}><IconPlay size={11} /> Preview now</button>
          <Toggle on={shownSsCfg?.enabled ?? false} onChange={(v) => saveScreensaver({ enabled: v })} />
        </div>
      }>
        {screensaverCfgError && <InlineAlert>{screensaverCfgError}</InlineAlert>}
        {shownSsCfg?.enabled && screensaverReg && !screensaverReg.active && (
          <div className="mb-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning)]">
            Windows is not showing the screensaver as active — check the system screensaver dialog.
          </div>
        )}
        {shownSsCfg?.enabled && (
          <div className="mb-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success)]">
            <StatusDot status="success" pulse /> Armed — activates after {shownSsCfg.timeout_secs}s of idle
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
            Idle timeout (seconds)
            <input
              type="number" min={1} max={3600}
              value={shownSsCfg?.timeout_secs ?? 300}
              onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 300); saveScreensaver({ timeout_secs: v }); }}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
            Scene
            <select
              value={screensaverSceneId || shownSsCfg?.scene?.id || ""}
              onChange={(e) => {
                const id = e.target.value;
                setScreensaverSceneId(id);
                const scene = (scenes ?? []).find((s) => s.id === id);
                // Don't null the saved scene if the list hasn't loaded yet.
                if (scene || id === "") saveScreensaver({ scene: scene ?? null });
              }}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">Current engine scene</option>
              {(scenes ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col justify-end text-xs text-[var(--text-tertiary)]">
            Move the mouse or press any key to exit — fullscreen, always-on-top, zero chrome.
          </div>
        </div>
        {/* P2-6 — see the scene before you arm it */}
        {screensaverScene && (
          <div className="mt-3">
            <div className="mb-1 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Scene preview</div>
            <ScenePreview kind={screensaverScene.kind} colors={screensaverScene.colors} speed={screensaverScene.speed} density={screensaverScene.density} className="h-32 w-full rounded-lg" />
          </div>
        )}
      </Section>
      </div>

      {/* ---- Video / GIF wallpaper ---- */}
      <div ref={videoRef}>
      <Section title="Video & GIF wallpaper" subtitle="Loop a video or animated image — MP4, WebM and GIF, normalized on import" actions={engine?.media ? (<div className="flex gap-2"><button className="btn-ghost shrink-0 text-xs" onClick={toggleVideoPaused}>{videoPaused ? <><IconPlay size={12} /> Resume</> : <><IconPause size={12} /> Pause</>}</button><button className="btn-danger shrink-0 text-xs" disabled={videoBusy} onClick={stopVideoWallpaper}><IconPower size={12} /> Stop video</button></div>) : undefined}>
        {videoError && <InlineAlert>{videoError}</InlineAlert>}
        {transcodeError && <InlineAlert>{transcodeError}</InlineAlert>}
        <div className="mb-3 flex gap-2">
          <input className="input" placeholder="C:\videos\aurora.mp4" value={videoPath} onChange={(e) => setVideoPath(e.target.value)} />
          <button className="btn-primary shrink-0" onClick={setVideoWallpaper} disabled={videoBusy || !videoPath.trim()}>{videoBusy ? "Importing…" : "Set video"}</button>
        </div>
        {/* P2-1 — import quality preset lives here too (not just Settings) */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-2xs text-[var(--text-tertiary)]">Import quality:</span>
          {(["high", "balanced", "performance"] as const).map((p) => (
            <button
              key={p}
              onClick={() =>
                call<TranscodeConfig>("set_transcode_config", { config: { preset: p } })
                  .then(() => { refreshTranscodeCfg(); toast(`Video imports → ${p}`); })
                  .catch((e) => toast(errorCopy(e), "err"))
              }
              className={`rounded-lg border px-2.5 py-1 text-2xs capitalize transition-colors ${(transcodeCfg?.preset ?? "balanced") === p ? "border-[var(--accent-hex)] bg-[var(--accent-hex)]/10 text-[var(--text-primary)]" : "border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
            >
              {p}
            </button>
          ))}
          <span className="text-2xs text-[var(--text-tertiary)]">high = best quality, biggest files · performance = fastest, smallest</span>
        </div>
        {/* M-1 — pin the video to one monitor or span them all */}
        {wallpapers && wallpapers.monitors.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-2xs text-[var(--text-tertiary)]">Play on:</span>
            <select value={videoMonitor} onChange={(e) => setVideoMonitor(e.target.value)} aria-label="Monitor for new video wallpapers">
              <option value="">All monitors</option>
              {wallpapers.monitors.map((m) => (<option key={m.id} value={m.id}>{m.id}</option>))}
            </select>
            <span className="text-2xs text-[var(--text-tertiary)]">applies to the next video you set</span>
          </div>
        )}
        {videoBusy && transcodeNote && (
          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-hex)]" />
            {transcodeNote}
          </div>
        )}
        {transcode && !transcode.available && (
          <div className="mb-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning)]">
            ffmpeg isn't bundled — videos play without normalization.
          </div>
        )}
        {engine?.media && (
          <div className="mb-3 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-2.5 text-sm text-[var(--status-success)]">
            <StatusDot status="success" pulse /> Now playing: <b>{engine.media.name}</b> ({engine.media.width}×{engine.media.height})
          </div>
        )}
        {!videoError && (videoWallpapers ?? []).length > 0 && (
          <>
            <div className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Imported media</div>
            <div className="flex flex-wrap gap-2">
              {(videoWallpapers ?? []).map((v) => (
                <button key={v.path} onClick={() => call<EngineState>("set_video_wallpaper", { source: v.path, monitor: videoMonitor || undefined }).then(() => { refreshEngine(); toast(`Video → ${v.name}`); }).catch((e) => toast(errorCopy(e), "err"))} className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${engine?.media?.path === v.path ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)]" : "border-[var(--border-default)] bg-[var(--surface-overlay)] hover:bg-[var(--surface-hover)]"}`}>
                  <div className="font-medium text-[var(--text-primary)]">{v.name}</div>
                  <div className="text-2xs text-[var(--text-tertiary)]">{v.kind} · {v.width}×{v.height}{engine?.media?.monitor ? <> · pinned to {engine.media.monitor}</> : null}</div>
                </button>
              ))}
            </div>
          </>
        )}
        {!videoError && (videoWallpapers ?? []).length === 0 && (
          <div className="empty-state">
            No imported videos yet — paste a path above to loop an MP4, WebM or GIF.
          </div>
        )}
      </Section>
      </div>

      {/* ---- Widget Engine ---- */}
      <div ref={widgetsRef}>
      <Section title="Widget Engine" subtitle="Desktop widgets — clock, stats, notes, to-do, calendar, battery, toggles, world clock, agenda" actions={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {["clock", "stats", "note", "todo", "calendar", "battery", "toggles", "worldclock", "agenda"].map((k) => (
            <button key={k} className="btn-ghost btn-sm capitalize" onClick={() => createWidget(k)}><IconPlus size={12} /> {k}</button>
          ))}
          {(widgets ?? []).length > 0 && (
            <button className="btn-ghost btn-sm" onClick={resetWidgetLayout} title="Snap every widget back to the default grid (undoable)">
              Reset layout
            </button>
          )}
        </div>
      }>
        {widgetsError && <InlineAlert>{widgetsError}</InlineAlert>}
        {!widgetsError && (widgets ?? []).length === 0 && (
          <div className="empty-state">No widgets yet. Add a clock, stats meter, sticky note, to-do list, or calendar.</div>
        )}
        {!widgetsError && (widgets ?? []).length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(widgets ?? []).map((w) => (
              <div key={w.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium capitalize text-[var(--text-primary)]">{w.kind}</div>
                  <div className="text-2xs text-[var(--text-tertiary)]">{w.visible ? "on desktop" : "hidden"}</div>
                </div>
                <Toggle on={w.visible} onChange={(v) => toggleWidget(w, v)} />
                <button className="text-[var(--text-tertiary)] hover:text-[var(--status-danger)]" onClick={() => removeWidget(w)}><IconTrash size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--surface-overlay)] px-3 py-2">
          <div>
            <div className="text-xs font-medium text-[var(--text-primary)]">Auto-hide on fullscreen</div>
            <div className="text-2xs text-[var(--text-tertiary)]">Widgets duck while a fullscreen app or game has focus — re-show when you return to the desktop</div>
          </div>
          <Toggle on={widgetsSettings?.autohide_fullscreen ?? true} onChange={(v) => saveWidgetsSettings({ autohide_fullscreen: v })} />
        </div>
      </Section>
      </div>

      {/* ---- Widget board preview (S9.6) ---- */}
      <div ref={boardRef}>
      <Section title="Widget board" subtitle="A live desktop mock — widgets at their real positions, scaled to fit">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[var(--border-default)] bg-[#0b1220]">
          {engine?.scene && engine.scene.kind && engine.scene.colors.length >= 2 ? (
            <ScenePreview kind={engine.scene.kind} colors={engine.scene.colors} speed={engine.scene.speed} density={engine.scene.density} className="absolute inset-0 h-full w-full" />
          ) : (
            // content preview fallback while no scene is live
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }} />
          )}
          <div className="absolute bottom-0 left-0 right-0 h-[6%] bg-black/45" />
          {(widgets ?? []).filter((w) => w.visible).map((w) => (
            <div
              key={w.id}
              className="absolute rounded-lg border border-white/15 bg-[rgba(10,14,28,0.72)] px-2 py-1 text-2xs text-white/90 shadow-md"
              style={{
                left: `${(w.x / 1920) * 100}%`,
                top: `${(w.y / 1080) * 100}%`,
                width: `${Math.max((w.w / 1920) * 100, 4)}%`,
              }}
              title={`${w.kind} at ${Math.round(w.x)},${Math.round(w.y)}`}
            >
              <span className="font-medium capitalize">{w.kind}</span>
            </div>
          ))}
          {(widgets ?? []).filter((w) => w.visible).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50">No visible widgets — add one above</div>
          )}
        </div>
      </Section>
      </div>

      {/* ---- Taskbar redesigner ---- */}
      <div ref={taskbarRef}>
      <Section title="Taskbar redesigner" subtitle="Size, alignment, auto-hide & color-match — registry-backed" actions={pendingShell?.pending ? (<div className="flex gap-2"><button className="btn-ghost shrink-0 text-xs" onClick={revertPending}>↩ Revert</button><button className="btn-primary shrink-0 text-xs" onClick={applyPendingRestart}>↻ Restart Explorer</button></div>) : undefined}>
        {taskbarError && <InlineAlert>{taskbarError}</InlineAlert>}
        {pendingError && <InlineAlert>{pendingError}</InlineAlert>}
        {taskbarCapsError && <InlineAlert>{taskbarCapsError}</InlineAlert>}
        {/* P2-4 — live mini-taskbar preview reflecting the pending state */}
        <div className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-3">
          <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Live preview</div>
          <div className="relative h-20 overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)]">
            <div
              className={`absolute inset-x-0 bottom-0 flex items-center gap-1.5 transition-all duration-150 ${taskbar?.alignment === "left" ? "justify-start pl-2" : "justify-center"} ${taskbar?.autohide ? "translate-y-2 opacity-60" : ""}`}
              style={{
                height: taskbar?.size === "small" ? "14px" : taskbar?.size === "large" ? "26px" : "20px",
                background: taskbar?.color_match ? "var(--accent-hex)" : "var(--surface-overlay)",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]" />
              ))}
            </div>
          </div>
          <div className="mt-1.5 text-2xs text-[var(--text-tertiary)]">
            {taskbar?.size} · {taskbar?.alignment} · {taskbar?.autohide ? "auto-hide" : "always visible"}{taskbar?.color_match ? " · accent-matched" : ""}
            {pendingShell?.pending ? " · changes queued — restart Explorer to apply" : ""}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm font-medium text-[var(--text-secondary)]">Icon size</div></div>
            <div className="segment">{["small", "medium", "large"].map((s) => (<button key={s} onClick={() => setTaskbarSize(s)} className={`segment-btn ${taskbar?.size === s ? "active" : ""}`}>{s}</button>))}</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm font-medium text-[var(--text-secondary)]">Alignment</div></div>
            <div className="segment">{["center", "left"].map((a) => (<button key={a} onClick={() => setTaskbarAlign(a)} className={`segment-btn ${taskbar?.alignment === a ? "active" : ""}`}>{a}</button>))}</div>
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-medium text-[var(--text-secondary)]">Auto-hide</div></div>
            <Toggle on={taskbar?.autohide ?? false} onChange={setTaskbarAutohide} />
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-medium text-[var(--text-secondary)]">Match accent color</div></div>
            <Toggle on={taskbar?.color_match ?? false} onChange={setTaskbarColorMatch} />
          </div>
          {(taskbarCaps?.reposition_supported ?? caps?.taskbar_reposition_supported) ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-sm font-medium text-[var(--text-secondary)]">Position</div><div className="text-2xs text-[var(--text-tertiary)]">Windows 10 only</div></div>
              <div className="segment">{["bottom", "top", "left", "right"].map((s) => (<button key={s} onClick={() => setTaskbarPosition(s)} className="segment-btn">{s}</button>))}</div>
            </div>
          ) : (
            // S3.10 — capability-gated dead controls: when the OS can't
            // reposition the taskbar (Win11), show a disabled explainer
            // instead of a live-looking control or a silent gap. The copy
            // comes from the backend command (P1-12) so it stays authoritative.
            <div className="flex flex-wrap items-center justify-between gap-3 opacity-60">
              <div><div className="text-sm font-medium text-[var(--text-secondary)]">Position</div><div className="text-2xs text-[var(--text-tertiary)]">{taskbarCaps?.note ?? "Windows 10 only — not available on this Windows version"}</div></div>
              <div className="segment" aria-disabled="true">{["bottom", "top", "left", "right"].map((s) => (<button key={s} disabled className="segment-btn">{s}</button>))}</div>
            </div>
          )}
          {pendingShell?.pending ? (
            <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning)]">
              {pendingShell.changes.length} change(s) queued. Restart Explorer to apply, or revert.
            </div>
          ) : (
            <p className="text-2xs text-[var(--text-tertiary)]">Changes queue up and apply together on one Explorer restart.</p>
          )}
        </div>
      </Section>
      </div>

      {/* ---- Sound scheme editor ---- */}
      <div ref={soundsRef}>
      <Section title="Sound scheme editor" subtitle="Windows system sounds — per-user, applied immediately">
        {schemesError && <InlineAlert>{schemesError}</InlineAlert>}
        {soundEventsError && <InlineAlert>{soundEventsError}</InlineAlert>}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(schemes ?? []).map((s) => (<button key={s.guid} onClick={() => applyScheme(s.guid)} className={`rounded-full px-3 py-1 text-xs transition-colors ${s.current ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>{s.name}</button>))}
          {!schemesError && (schemes ?? []).length === 0 && <span className="text-2xs text-[var(--text-tertiary)]">No schemes detected.</span>}
        </div>
        <div className="mb-4 flex gap-2">
          <input className="input" placeholder="Save current sounds as a scheme…" value={schemeName} onChange={(e) => setSchemeName(e.target.value)} />
          <button className="btn-ghost btn-sm shrink-0" onClick={saveScheme} disabled={!schemeName.trim()}>Save scheme</button>
        </div>
        {/* P2-2 — import your own .wav into the current scheme */}
        <div className="mb-4 flex gap-2">
          <input className="input" placeholder="C:\sounds\notify.wav — import your own sound" value={soundImportPath} onChange={(e) => setSoundImportPath(e.target.value)} aria-label="Sound file to import" />
          <button
            className="btn-ghost btn-sm shrink-0"
            disabled={!soundImportPath.trim()}
            onClick={() =>
              call<string>("import_sound_asset", { source: soundImportPath.trim() })
                .then((m) => { toast(m); setSoundImportPath(""); refreshSounds(); })
                .catch((e) => toast(errorCopy(e), "err"))
            }
          >
            <IconUpload size={12} /> Import .wav
          </button>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(soundEvents ?? []).map((evt) => (
            <div key={evt.event} className="flex items-center gap-2 rounded-lg bg-[var(--surface-overlay)] px-3 py-2">
              <span className="flex-1 truncate text-xs text-[var(--text-secondary)]" title={evt.label}>{evt.label}</span>
              {evt.has_sound && <button className="text-2xs text-[var(--text-secondary)] hover:underline" onClick={() => previewSound(evt.current)}>Preview</button>}
              <button className="text-2xs text-[var(--text-tertiary)] hover:text-[var(--status-danger)]" onClick={() => setEventSound(evt.event, "")}>Clear</button>
            </div>
          ))}
        </div>
      </Section>
      </div>

      {/* ---- System font replacer ---- */}
      <div ref={fontsRef}>
      <Section title="System font replacer" subtitle="Swap the UI font via FontSubstitutes — needs admin">
        {fontSubsError && <InlineAlert>{fontSubsError}</InlineAlert>}
        {installedFontsError && <InlineAlert>{installedFontsError}</InlineAlert>}
        {capsError && <InlineAlert>{capsError}</InlineAlert>}
        {caps && !caps.admin && (
          <div className="mb-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning)]">
            Font substitution needs admin. Relaunch elevated.
          </div>
        )}
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1"><span className="label">Replace font</span><input className="input" list="font-list" value={fontOriginal} onChange={(e) => setFontOriginal(e.target.value)} /></div>
            <div className="min-w-40 flex-1"><span className="label">With</span><input className="input" list="font-list" placeholder="e.g. Segoe UI Variable" value={fontSubstitute} onChange={(e) => setFontSubstitute(e.target.value)} /></div>
            <button className="btn-primary shrink-0" onClick={applyFontSub}>Apply</button>
          </div>
          <datalist id="font-list">{(installedFonts ?? []).map((f) => (<option key={f.name} value={f.name} />))}</datalist>
        </div>
        {/* P2-3 — see the font before you commit to it */}
        <div className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-3">
          <div className="mb-1 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Preview</div>
          <div
            className="text-lg leading-snug text-[var(--text-primary)]"
            style={{ fontFamily: `"${fontSubstitute || fontOriginal || "Segoe UI"}", Segoe UI, system-ui, sans-serif` }}
          >
            The quick brown fox jumps over the lazy dog — AaBbCc 0123456789
          </div>
          <div className="mt-1 text-2xs text-[var(--text-tertiary)]">
            {fontSubstitute
              ? `Rendered in “${fontSubstitute}” — applies system-wide after an Explorer restart.`
              : "Type a font name in the “With” field above to preview it before applying."}
          </div>
        </div>
        <div className="mb-4 flex gap-2">
          <input className="input" placeholder="C:\fonts\MyFont.ttf" value={fontInstallPath} onChange={(e) => setFontInstallPath(e.target.value)} />
          <button className="btn-ghost btn-sm shrink-0" onClick={installFont} disabled={!fontInstallPath.trim()}>Install font</button>
        </div>
        {(fontSubs ?? []).length > 0 && (
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Active substitutions</span>
            <button
              className="text-2xs text-[var(--text-tertiary)] hover:text-[var(--status-danger)]"
              onClick={() =>
                Promise.all((fontSubs ?? []).map((s) => call("set_font_substitution", { original: s.original, substitute: "" })))
                  .then(() => { toast("All font substitutions reset"); refreshFontSubs(); })
                  .catch((e) => toast(errorCopy(e), "err"))
              }
            >
              Restore all
            </button>
          </div>
        )}
        <div className="space-y-1.5">
          {(fontSubs ?? []).map((s) => (
            <div key={s.original} className="flex items-center gap-2 rounded-lg bg-[var(--surface-overlay)] px-3 py-2">
              <span className="flex-1 text-xs text-[var(--text-secondary)]">{s.original} → <b className="text-[var(--text-primary)]">{s.substituted}</b></span>
              <button className="text-2xs text-[var(--text-tertiary)] hover:text-[var(--status-danger)]" onClick={() => call<FontSubstitution[]>("set_font_substitution", { original: s.original, substitute: "" }).then(() => refreshFontSubs()).catch((e) => toast(errorCopy(e), "err"))}>Reset</button>
            </div>
          ))}
          {!fontSubsError && (fontSubs ?? []).length === 0 && <p className="text-2xs text-[var(--text-tertiary)]">No font substitutions active.</p>}
        </div>
        {(installedFonts ?? []).filter((f) => f.source === "user").length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Your user fonts</div>
            {(installedFonts ?? []).filter((f) => f.source === "user").map((f) => (
              <div key={f.name} className="flex items-center gap-2 rounded-lg bg-[var(--surface-overlay)] px-3 py-2">
                <span className="flex-1 text-xs text-[var(--text-secondary)]">{f.name}</span>
                <button className="text-2xs text-[var(--text-tertiary)] hover:text-[var(--status-danger)]" onClick={() => removeFont(f.name)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </Section>
      </div>

      {/* ---- Lock screen designer ---- */}
      <div ref={lockRef}>
      <Section title="Lock screen designer" subtitle="Image, slideshow or spotlight — no admin needed">
        {lockScreenError && <InlineAlert>{lockScreenError}</InlineAlert>}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[{ id: "image", label: "Single image" }, { id: "slideshow", label: "Slideshow" }, { id: "spotlight", label: "Spotlight" }].map((m) => (
            <button key={m.id} onClick={() => (m.id === "image" ? setLsImage() : m.id === "slideshow" ? setLsSlideshow() : setLsSpotlight())} className={`rounded-full px-3 py-1 text-xs transition-colors ${lockScreen?.mode === m.id ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>{m.label}</button>
          ))}
        </div>
        <div className="mb-3 flex gap-2">
          <input className="input" placeholder="C:\pictures\lock.png (image mode)" value={lsImagePath} onChange={(e) => setLsImagePath(e.target.value)} />
          <button className="btn-ghost btn-sm shrink-0" onClick={previewLockScreen} disabled={!lsImagePath.trim()}>Preview</button>
          <button className="btn-ghost btn-sm shrink-0" onClick={setLsImage} disabled={!lsImagePath.trim()}>Set image</button>
        </div>
        {lsPreview && (
          <div className="mb-3 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)]">
            <img src={lsPreview} alt="Lock screen image preview" className="w-full object-cover" style={{ maxHeight: 240 }} />
          </div>
        )}
        <div className="mb-3 space-y-2 rounded-xl bg-[var(--surface-overlay)] p-3">
          <div className="flex gap-2">
            <input className="input" placeholder="C:\pictures\slideshow (folder)" value={lsFolder} onChange={(e) => setLsFolder(e.target.value)} />
            <button className="btn-ghost btn-sm shrink-0" onClick={setLsSlideshow} disabled={!lsFolder.trim()}>Use folder</button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xs text-[var(--text-tertiary)]">Interval</span>
            <select value={lsInterval} onChange={(e) => setLsInterval(Number(e.target.value))}>
              {[10, 30, 60, 180, 360, 720, 1440].map((m) => (<option key={m} value={m}>{m} min</option>))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div><div className="text-sm font-medium text-[var(--text-secondary)]">Hide detailed status</div></div>
          <Toggle on={lockScreen?.hide_apps ?? false} onChange={setLsHideApps} />
        </div>
      </Section>
      </div>

      {/* ---- Roadmap (honest) ---- */}
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "Window FX", desc: "Blur, transparency, rounded corners & animation speed." },
          { title: "Right-click cleaner", desc: "Tidy context menus and theme them." },
          { title: "Folder color-coding", desc: "Color your folders for instant recognition." },
          { title: "Animated screensaver", desc: "Turn any scene into a screensaver." },
          { title: "Login / boot skinning", desc: "OS-blocked in Win11 — needs third-party tooling." },
        ].map((c) => (
          <div key={c.title} className="card p-4 opacity-60">
            <div className="text-sm font-semibold text-[var(--text-primary)]">{c.title}</div>
            <p className="mt-1 text-2xs text-[var(--text-tertiary)]">{c.desc}</p>
            <div className="mt-2 text-2xs text-[var(--text-tertiary)]">On roadmap</div>
          </div>
        ))}
      </div>

      {/* ---- Modals ---- */}
      <Modal open={studioOpen} title="Wallpaper Studio — build your own scene" onClose={() => setStudioOpen(false)} onConfirm={applyStudio} confirmLabel="Apply to desktop">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-[var(--border-strong)]">
            <ScenePreview kind={studio.kind} colors={studio.colors} speed={studio.speed} density={studio.density} className="h-32 w-full" />
          </div>
          <div>
            <span className="label">Template (A6.1 — 14 kinds)</span>
            <div className="grid grid-cols-4 gap-1.5">
              {["particles", "waves", "geometric", "parallax", "aurora", "stars", "embers", "rain", "fireflies", "snowfall-wind", "bokeh", "smoke", "waves-3d"].map((k) => (
                <button key={k} onClick={() => setStudio({ ...studio, kind: k })} className={`segment-btn ${studio.kind === k ? "active" : ""}`}>{k}</button>
              ))}
            </div>
          </div>
          <div><span className="label">Speed · {studio.speed.toFixed(1)}x</span><input type="range" min={0.2} max={3} step={0.1} value={studio.speed} onChange={(e) => setStudio({ ...studio, speed: +e.target.value })} className="w-full" /></div>
          <div><span className="label">Density · {studio.density.toFixed(1)}x</span><input type="range" min={0.2} max={2} step={0.1} value={studio.density} onChange={(e) => setStudio({ ...studio, density: +e.target.value })} className="w-full" /></div>
          <div>
            <span className="label">Colors</span>
            <div className="flex gap-2">
              {studio.colors.map((c, i) => (
                <input key={i} type="color" value={c} onChange={(e) => { const colors = [...studio.colors]; colors[i] = e.target.value; setStudio({ ...studio, colors }); }} className="h-9 w-14 cursor-pointer rounded-lg border-0 bg-transparent" />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["complement", "analogous", "triadic"].map((mode) => (
                <button
                  key={mode}
                  className="btn-ghost btn-sm capitalize"
                  title={`Fill with the ${mode} palette of the first color`}
                  onClick={() => {
                    const base = studio.colors[0] ?? "#818cf8";
                    const pal = mode === "complement" ? [base, complement(base)] : mode === "analogous" ? [analogous(base, -40), base, analogous(base, 40)] : [base, triadic(base, 120), triadic(base, 240)];
                    setStudio({ ...studio, colors: pal.slice(0, 3) });
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={studio.name === "My Scene" ? "" : studio.name}
              placeholder="Scene name (saves a custom scene)"
              onChange={(e) => setStudio({ ...studio, name: e.target.value.trim() || "My Scene" })}
            />
            <button className="btn-ghost btn-sm shrink-0" onClick={saveStudioScene} disabled={studio.name === "My Scene"}>
              Save custom
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={quizOpen} title="Style match quiz" onClose={() => setQuizOpen(false)}>
        {quizDone ? (
          <div>
            <div className="mb-3 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              <BlurReveal text="Your top 3 matches" />
            </div>
            <div className="space-y-2">
              {quizResults.map((s, i) => (
                <div key={s.id} className={`rounded-xl border p-3 ${i === 0 ? "border-[var(--border-accent)]" : "border-[var(--border-default)]"}`}>
                  <div className="flex items-center gap-3">
                    {/* content preview — renders the actual gradient wallpaper */}
                    <div className="h-12 w-16 shrink-0 rounded-lg" style={{ background: `linear-gradient(135deg, ${s.gradient[0]}, ${s.gradient[1]})` }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[var(--text-primary)]" title={`${i + 1}. ${s.name}`}>{i + 1}. {s.name}</div>
                      <div className="truncate text-2xs text-[var(--text-tertiary)]" title={s.tagline}>{s.tagline}</div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-active)]">
                        <div className="h-full rounded-full bg-[var(--accent-hex)]" style={{ width: `${Math.min(100, Math.round((scoreStyle(s, answers) / 28) * 100))}%` }} />
                      </div>
                    </div>
                  </div>
                  <button className="btn-primary mt-2.5 w-full !h-7 text-xs" onClick={() => applyStyle(s)} disabled={applyingStyle !== null}>
                    {applyingStyle === s.id ? "Applying…" : appliedStyleId === s.id ? `Re-apply “${s.name}”` : `Apply “${s.name}”`}
                  </button>
                </div>
              ))}
            </div>
            {myStyle && (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--border-strong)] p-3">
                <div className="flex items-center gap-3">
                  {/* content preview — renders the actual gradient wallpaper */}
                  <div className="h-12 w-16 shrink-0 rounded-lg" style={{ background: `linear-gradient(135deg, ${myStyle.gradient[0]}, ${myStyle.gradient[1]})` }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Your personal style</div>
                    <div className="truncate text-2xs text-[var(--text-tertiary)]" title={`Built from your answers — ${myStyle.mode} mode, ${myStyle.accent_hex} accent, ${myStyle.wallpaperName ?? "a living scene"}`}>Built from your answers — {myStyle.mode} mode, {myStyle.accent_hex} accent, {myStyle.wallpaperName ?? "a living scene"}</div>
                  </div>
                </div>
                <button className="btn-ghost mt-2.5 w-full !h-7 text-xs" onClick={() => { setDetailStyle(myStyle); setQuizOpen(false); }}>Preview & apply</button>
              </div>
            )}
            <button className="mt-3 w-full text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" onClick={resetQuiz}>Retake the quiz</button>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Question {quizStep + 1} of {QUIZ.length}</span>
              <div className="flex gap-1">{QUIZ.map((_, i) => (<span key={i} className={`h-1 w-3.5 rounded-full transition-colors ${i <= quizStep ? "bg-[var(--accent-hex)]" : "bg-[var(--surface-active)]"}`} />))}</div>
            </div>
            <p key={quizStep} aria-live="polite" className="mb-4 text-base font-medium text-[var(--text-primary)] animate-fade-in">{QUIZ[quizStep].q}</p>
            <div className="space-y-2">
              {QUIZ[quizStep].options.map((opt, i) => (
                <button key={i} onClick={() => pickQuiz(i)} className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-default)] px-4 py-2.5 text-left transition-colors hover:border-[var(--border-accent)] hover:bg-[var(--surface-hover)]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--text-tertiary)]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--text-primary)]">{opt.label}</span>
                    {opt.sub && <span className="block text-2xs text-[var(--text-tertiary)]">{opt.sub}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Style detail modal */}
      <Modal
        open={detailStyle !== null}
        title={detailStyle?.name ?? "Style"}
        onClose={() => setDetailStyle(null)}
        onConfirm={() => { if (detailStyle) applyStyle(detailStyle, { animated: animOn }); }}
        confirmLabel={animOn ? "Apply with animated wallpaper" : "Apply this style"}
      >
        {detailStyle && (
          <div>
            {/* Static / Animated toggle — every style has an animated twin (B2.3) */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Wallpaper</div>
              <div className="segment">
                <button className={`segment-btn ${!animOn ? "active" : ""}`} onClick={() => setAnimOn(false)}>Static</button>
                <button className={`segment-btn ${animOn ? "active" : ""}`} onClick={() => setAnimOn(true)}>Animated</button>
              </div>
            </div>
            {animOn ? (
              <div className="mb-3 h-24 w-full overflow-hidden rounded-lg border border-[var(--border-strong)]">
                <ScenePreview kind={sceneConfigForStyle(detailStyle).kind} colors={sceneConfigForStyle(detailStyle).colors} speed={sceneConfigForStyle(detailStyle).speed} density={sceneConfigForStyle(detailStyle).density} className="h-full w-full" />
              </div>
            ) : (
              // content preview — renders the actual gradient wallpaper
              <div className="mb-3 h-24 w-full rounded-lg" style={{ background: `linear-gradient(135deg, ${detailStyle.gradient[0]}, ${detailStyle.gradient[1]})` }} />
            )}
            {animOn && detailStyle.wallpaper.type === "live" && (
              <p className="mb-2 text-2xs text-[var(--text-tertiary)]">Animated mode uses a living scene instead of the looping video — lighter on GPU.</p>
            )}
            <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">{detailStyle.tagline}</p>
            <p className="mb-3 text-xs text-[var(--text-secondary)]">{detailStyle.description}</p>
            <div className="mb-3 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">What it changes</div>
            <ul className="mb-3 space-y-1">
              {styleComponents(detailStyle).map((c) => (
                <li key={c} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--accent-hex)]" />{c}
                </li>
              ))}
            </ul>
            {detailStyle.wallpaperName && (
              <p className="mb-3 text-2xs text-[var(--text-tertiary)]">Wallpaper: {detailStyle.wallpaperName}</p>
            )}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {detailStyle.collection && <span className="badge badge-accent !text-2xs">{detailStyle.collection}</span>}
              <span className="badge badge-neutral !text-2xs">{detailStyle.axis ?? detailStyle.tier}</span>
              {detailStyle.axis && <span className="badge badge-neutral !text-2xs">{detailStyle.axis} variant</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {detailStyle.tags.map((t) => (<span key={t} className="badge badge-neutral !text-2xs">{t}</span>))}
            </div>
            <button
              className={`btn-ghost mt-3 w-full btn-sm ${favorites.includes(detailStyle.id) ? "!text-amber-500" : ""}`}
              onClick={() => toggleFav(detailStyle.id)}
            >
              <IconStar size={12} className={favorites.includes(detailStyle.id) ? "fill-amber-400 text-amber-400" : ""} />
              {favorites.includes(detailStyle.id) ? "Favorited — click to remove" : "Add to favorites"}
            </button>
            {/* S6.5 — every style ships as a share code (offline, deterministic) */}
            {(() => {
              const code = detailStyle ? encodeStyleCode(detailStyle) : null;
              if (!code) return null;
              return (
                <div className="mt-3">
                  <div className="mb-1 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Share code</div>
                  <div className="flex gap-1.5">
                    <input readOnly value={code} onFocus={(e) => e.target.select()} className="input flex-1 !text-xs" spellCheck={false} />
                    <button
                      className="btn-ghost btn-sm shrink-0"
                      onClick={async () => {
                        const ok = await copyText(code);
                        toast(ok ? "Share code copied to clipboard" : `Copy blocked — select the code above (${code})`, ok ? "ok" : "info");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 text-2xs text-[var(--text-tertiary)]">Codes are offline and deterministic — share this and anyone can import the exact look.</p>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
