// Mock handlers: look & feel (theme, wallpaper, scenes, engine, cursors, sounds, fonts, lockscreen, displays, styles) — extracted from lib/mock.ts (V2 pillar 2a).
// Bodies are byte-identical to the original switch arms; this module only
// dispatches its own commands and returns undefined for anything else.
import type {
  DisplayProfile,
  SceneConfig,
  VideoWallpaper,
  WallpaperSlideshowConfig,
} from "../types";
import type { Store } from "./store";
import { pushUndo, uid, SCENES, resolveSchemeGuid } from "./store";

export async function handle<T>(cmd: string, s: Store, args: Record<string, unknown>): Promise<T | undefined> {
  switch (cmd) {
    case "get_theme_state":
      return { ...s.theme } as T;
    case "set_accent_color": {
      const before = s.theme.accent_hex;
      s.theme = { ...s.theme, accent_hex: args.hex as string, color_prevalence: true };
      pushUndo("accent", `Accent color → ${args.hex}`, true, { before, after: args.hex });
      return { ...s.theme } as T;
    }
    case "set_theme_mode": {
      const before = s.theme.mode;
      s.theme = { ...s.theme, mode: args.mode as "dark" | "light" };
      pushUndo("mode", `Theme mode → ${args.mode}`, true, { before, after: args.mode });
      return { ...s.theme } as T;
    }
    case "set_transparency": {
      const before = s.theme.transparency;
      s.theme = { ...s.theme, transparency: args.on as boolean };
      pushUndo("transparency", `Taskbar transparency ${args.on ? "on" : "off"}`, true, { before, after: args.on });
      return { ...s.theme } as T;
    }
    case "get_wallpapers":
      return { ...s.wallpaper, monitors: s.wallpaper.monitors.map((m) => ({ ...m })) } as T;
    case "set_wallpaper": {
      const before = s.wallpaper.current;
      s.wallpaper = { ...s.wallpaper, current: args.path as string };
      pushUndo("wallpaper", `Wallpaper → ${args.path}`, true, { before, after: args.path });
      return { ...s.wallpaper } as T;
    }
    case "set_monitor_wallpaper": {
      const before = s.wallpaper.current;
      s.wallpaper = {
        ...s.wallpaper,
        current: args.path as string,
        monitors: s.wallpaper.monitors.map((m) => (m.id === args.monitor_id ? { ...m, wallpaper: args.path as string } : m)),
      };
      pushUndo("wallpaper", `Wallpaper → ${args.path} (per-monitor)`, true, { before, after: args.path });
      return { ...s.wallpaper } as T;
    }
    case "list_packs":
      return s.packs.map((p) => ({ ...p })) as T;
    case "apply_pack": {
      const pack = s.packs.find((p) => p.id === args.id);
      if (!pack) throw new Error("Unknown pack");
      pushUndo("accent", `[${pack.name}] Accent → ${pack.accent_hex}`, true, { before: s.theme.accent_hex, after: pack.accent_hex });
      pushUndo("mode", `[${pack.name}] Mode → ${pack.mode}`, true, { before: s.theme.mode, after: pack.mode });
      const beforeWp = s.wallpaper.current;
      s.wallpaper = { ...s.wallpaper, current: `reforge://wallpapers/${pack.id}.png` };
      pushUndo("wallpaper", `[${pack.name}] Wallpaper applied`, true, { before: beforeWp, after: s.wallpaper.current });
      s.theme = { ...s.theme, accent_hex: pack.accent_hex, mode: pack.mode as "dark" | "light", color_prevalence: true };
      return { ...pack } as T;
    }
    case "list_cursor_schemes":
      return [
        { id: "aero", name: "Windows Aero", description: "The modern Windows 10/11 cursors with the blue glow." },
        { id: "black", name: "Windows Black", description: "High-contrast black cursors — great on bright screens." },
        { id: "default", name: "System default", description: "Reset everything to whatever Windows is using by default." },
      ] as T;
    case "get_cursor_state":
      return {
        scheme_source: s.theme.mode === "dark" ? "Reforge:aero" : "(default)",
        cursors: [
          { name: "Arrow", path: "C:\\Windows\\Cursors\\aero_arrow.cur" },
          { name: "Wait", path: "C:\\Windows\\Cursors\\aero_busy.ani" },
          { name: "Hand", path: "C:\\Windows\\Cursors\\aero_link.cur" },
        ],
      } as T;
    case "apply_cursor_scheme": {
      const scheme = (args.id as string);
      pushUndo("cursors", `Applied cursor scheme: ${scheme}`, true, { before: {}, after: scheme });
      return { scheme_source: `Reforge:${scheme}`, cursors: [] } as T;
    }

    // ---- animated wallpaper engine ----
    case "list_wallpaper_scenes":
      return [...SCENES, ...s.customScenes].map((x) => ({ ...x })) as T;
    case "save_custom_scene": {
      const sc = args.scene as SceneConfig;
      const existing = s.customScenes.findIndex((x) => x.id === sc.id);
      if (existing >= 0) s.customScenes[existing] = { ...sc };
      else s.customScenes.push({ ...sc });
      pushUndo("custom_scene_saved", `Saved custom scene “${sc.name}”`, false, { scene: sc });
      return s.customScenes.map((x) => ({ ...x })) as T;
    }
    case "delete_custom_scene": {
      const id = args.id as string;
      s.customScenes = s.customScenes.filter((x) => x.id !== id);
      pushUndo("custom_scene_deleted", `Deleted custom scene ${id}`, false, { id });
      return s.customScenes.map((x) => ({ ...x })) as T;
    }
    case "get_wallpaper_engine_state":
      return { ...s.engine, scene: s.engine.scene ? { ...s.engine.scene } : null } as T;
    case "set_animated_wallpaper": {
      const scene = args.scene as SceneConfig;
      s.engine = { ...s.engine, active: true, frozen: false, scene: { ...scene }, static_wallpaper: s.engine.static_wallpaper || s.wallpaper.current };
      pushUndo("animated_wallpaper", `Animated wallpaper → ${scene.name} (${scene.kind})`, true, { scene, before_active: false, static_wallpaper: s.engine.static_wallpaper });
      return { ...s.engine, scene: { ...scene } } as T;
    }
    case "stop_animated_wallpaper": {
      // Capture the scene BEFORE clearing the engine — the undo entry must
      // know what was playing so revert can restart it (B1.9 mock parity).
      const stopped = { scene: s.engine.scene, static_wallpaper: s.engine.static_wallpaper };
      s.engine = { active: false, frozen: false, scene: null, media: null, static_wallpaper: "" };
      pushUndo("animated_wallpaper_stop", "Stopped animated wallpaper (static restored)", true, stopped);
      return { ...s.engine } as T;
    }
    case "freeze_wallpaper": {
      s.engine = { ...s.engine, frozen: args.frozen as boolean };
      return { ...s.engine } as T;
    }

    // ---- displays ----
    case "get_display_info":
      return [
        { id: "\\\\.\\DISPLAY1", name: "\\\\.\\DISPLAY1", resolution: "2560x1440", refresh: 144, primary: true },
        { id: "\\\\.\\DISPLAY2", name: "\\\\.\\DISPLAY2", resolution: "1920x1080", refresh: 60, primary: false },
      ] as T;
    case "list_display_profiles":
      return s.displayProfiles.map((p) => ({ ...p })) as T;
    case "save_display_profile": {
      const p: DisplayProfile = { id: uid(), name: args.name as string, created_at: Date.now(), monitors: [{ id: "\\\\.\\DISPLAY1", wallpaper: "" }] };
      s.displayProfiles.push(p);
      return { ...p } as T;
    }
    case "apply_display_profile": {
      pushUndo("display_profile", `Applied display profile`, true, {});
      return "Applied profile" as T;
    }
    case "delete_display_profile": {
      s.displayProfiles = s.displayProfiles.filter((p) => p.id !== args.id);
      return null as T;
    }


    // ---- video wallpaper ----
    case "list_video_wallpapers":
      return s.videoWallpapers.map((v) => ({ ...v })) as T;
    case "set_video_wallpaper": {
      const v: VideoWallpaper = { path: String(args.source ?? ""), kind: "video", width: 1920, height: 1080, name: String(args.source ?? "").split(/[\\/]/).pop() || "media" };
      s.engine = { ...s.engine, active: true, frozen: false, scene: null, media: v, static_wallpaper: s.engine.static_wallpaper || s.wallpaper.current };
      pushUndo("video_wallpaper", `Video wallpaper → ${v.name}`, true, { video: v });
      return { ...s.engine, media: { ...v } } as T;
    }
    case "stop_video_wallpaper": {
      s.engine = { ...s.engine, active: false, frozen: false, scene: null, media: null, static_wallpaper: "" };
      pushUndo("video_wallpaper_stop", "Stopped video wallpaper (static restored)", true, { video: null });
      return { ...s.engine, media: null } as T;
    }
    case "set_video_paused":
      return (args.paused ? "Video paused" : "Video playing") as T;

    // ---- sounds ----
    case "list_sound_schemes":
      return s.sounds.map((x) => ({ ...x })) as T;
    case "get_current_scheme": {
      const cur = s.sounds.find((x) => x.current) ?? s.sounds[0];
      return { ...cur, current: true } as T;
    }
    case "apply_sound_scheme": {
      const target = resolveSchemeGuid(args.guid as string);
      const before = s.sounds.find((x) => x.current)?.guid ?? "";
      s.sounds = s.sounds.map((x) => ({ ...x, current: x.guid === target }));
      const name = s.sounds.find((x) => x.guid === target)?.name ?? target as string;
      pushUndo("sound_scheme", `Sound scheme → ${name}`, true, { before, after: args.guid });
      return `Sound scheme changed to ${name}.` as T;
    }
    case "list_sound_events":
      return [
        { event: "SystemNotification", label: "Notification", current: "", default: "", has_sound: false },
        { event: "DeviceConnect", label: "Device connect", current: "", default: "", has_sound: false },
        { event: "SystemAsterisk", label: "Asterisk", current: "", default: "", has_sound: false },
      ] as T;
    case "set_sound_event": {
      pushUndo("sound_event", `Sound for ${args.event} → ${args.path ? args.path : "(none)"}`, true, { event: args.event, before: "", after: args.path });
      return { event: args.event, label: args.event, current: args.path as string, default: "", has_sound: !!(args.path as string) } as T;
    }
    case "preview_sound":
      return "Playing…" as T;
    case "stop_preview":
      return null as T;
    case "import_sound_asset":
      return "Imported sound → app data (WAV)" as T;
    case "save_current_scheme": {
      const guid = "{" + uid() + "}";
      s.sounds = s.sounds.map((x) => ({ ...x, current: false })).concat([{ guid, name: args.name as string, current: true, builtin: false }]);
      pushUndo("sound_scheme", `Saved sound scheme '${args.name}' and switched to it`, true, { before: "", after: guid });
      return `Scheme '${args.name}' saved and is now active.` as T;
    }

    // ---- fonts ----
    case "list_installed_fonts":
      return [
        { name: "Segoe UI", filename: "segoeui.ttf", source: "system", substituted_to: null },
        { name: "Segoe UI Variable", filename: "SegUIVar.ttf", source: "system", substituted_to: null },
        { name: "Arial", filename: "arial.ttf", source: "system", substituted_to: null },
      ] as T;
    case "list_font_substitutions":
      return s.fonts.map((f) => ({ ...f })) as T;
    case "set_font_substitution": {
      const before = s.fonts.find((f) => f.original === args.original)?.substituted ?? "";
      s.fonts = s.fonts.filter((f) => f.original !== args.original);
      if (args.substitute) s.fonts.push({ original: args.original as string, substituted: args.substitute as string });
      pushUndo("font_substitution", `Font substitution: ${args.original} → ${args.substitute || "(default)"}`, true, { original: args.original, before, after: args.substitute });
      return s.fonts.map((f) => ({ ...f })) as T;
    }
    case "install_user_font":
      pushUndo("font_install", `Installed user font: ${String(args.path).split(/[\\/]/).pop()}`, true, { name: String(args.path).split(/[\\/]/).pop() });
      return [
        { name: "Segoe UI", filename: "segoeui.ttf", source: "system", substituted_to: null },
        { name: "My Font", filename: "my-font.ttf", source: "user", substituted_to: null },
      ] as T;
    case "remove_user_font":
      pushUndo("font_uninstall", `Removed user font: ${args.name}`, true, { name: args.name });
      return [
        { name: "Segoe UI", filename: "segoeui.ttf", source: "system", substituted_to: null },
      ] as T;

    // ---- lock screen ----
    case "get_lock_screen_state":
      return { ...s.lockscreen } as T;
    case "set_lock_screen_image":
      s.lockscreen = { ...s.lockscreen, mode: "image", image_path: String(args.source ?? ""), slideshow_folder: null };
      pushUndo("lock_screen", "Set lock screen image", true, { mode: "image" });
      return { ...s.lockscreen } as T;
    case "set_lock_screen_slideshow":
      s.lockscreen = { ...s.lockscreen, mode: "slideshow", slideshow_folder: args.folder as string, slideshow_interval_secs: (args.interval_minutes as number) * 60, slideshow_shuffle: args.shuffle as boolean, image_path: null };
      pushUndo("lock_screen", "Set lock screen slideshow", true, { mode: "slideshow" });
      return { ...s.lockscreen } as T;
    case "set_lock_screen_spotlight":
      s.lockscreen = { ...s.lockscreen, mode: "spotlight", image_path: null, slideshow_folder: null };
      pushUndo("lock_screen", "Enabled lock screen spotlight", true, { mode: "spotlight" });
      return { ...s.lockscreen } as T;
    case "set_lock_screen_hide_apps":
      s.lockscreen = { ...s.lockscreen, hide_apps: args.hide as boolean };
      pushUndo("lock_screen", `Lock screen detailed status ${args.hide ? "hidden" : "shown"}`, true, { hide_apps: args.hide });
      return { ...s.lockscreen } as T;

    // ---- static wallpaper: slideshow + history ----
    case "get_wallpaper_slideshow":
      return { ...s.slideshow } as T;
    case "set_wallpaper_slideshow": {
      s.slideshow = { ...(args.cfg as WallpaperSlideshowConfig) };
      if (s.slideshow.enabled) s.slideshow.next_rotation_ts = Date.now() + s.slideshow.interval_minutes * 60000;
      else s.slideshow.next_rotation_ts = null;
      pushUndo("wallpaper_slideshow", `Wallpaper rotation ${s.slideshow.enabled ? `on (every ${s.slideshow.interval_minutes} min)` : "off"}`, true, { enabled: s.slideshow.enabled });
      return { ...s.slideshow } as T;
    }
    case "skip_slideshow": {
      // Preview: no real folder — advance to a plausible next image so the
      // command round-trips honestly.
      const cfg = s.slideshow;
      if (!cfg.enabled || !cfg.folder.trim()) {
        throw new Error("Slideshow is not enabled — nothing to skip");
      }
      const name = `next-${(cfg.last_applied ?? "a").split(/[\\/]/).pop()}`;
      s.slideshow = {
        ...cfg,
        last_applied: `${cfg.folder}\\${name}.jpg`,
        next_rotation_ts: Date.now() + cfg.interval_minutes * 60_000,
      };
      return `Skipped to ${s.slideshow.last_applied}` as T;
    }
    case "get_wallpaper_history":
      return s.wallpaperHistory.map((h) => ({ ...h })) as T;

    // ---- Style Engine (C1.4): atomic, single undo entry, composite revert ----
    case "apply_style": {
      const st = args.style as {
        id: string;
        name: string;
        mode?: "dark" | "light";
        accent_hex?: string;
        transparency?: boolean;
        wallpaper?: string;
        wallpaper_type?: "static" | "live" | "scene";
        scene?: SceneConfig;
        font?: string;
        sound_scheme?: string;
        rgb?: "accent-sync" | "off";
      };
      const before = {
        accent: s.theme.accent_hex,
        mode: s.theme.mode,
        transparency: s.theme.transparency,
        wallpaper: s.wallpaper.current,
        engine: { active: s.engine.active, frozen: s.engine.frozen, scene: s.engine.scene, media: s.engine.media, static_wallpaper: s.engine.static_wallpaper },
        sound_scheme: s.sounds.find((x) => x.current)?.guid ?? "",
        font: { original: "Segoe UI Variable", before: s.fonts.find((f) => f.original === "Segoe UI Variable")?.substituted ?? "" },
        rgb: [],
      };
      const notes: string[] = [];
      // deeper components first (A1.6) — mirrors the Rust atomic order
      if (st.font) {
        const beforeFont = s.fonts.find((f) => f.original === "Segoe UI Variable")?.substituted ?? "";
        s.fonts = [...s.fonts.filter((f) => f.original !== "Segoe UI Variable"), { original: "Segoe UI Variable", substituted: st.font }];
        pushUndo("font_substitution", `Font substitution: Segoe UI Variable → ${st.font}`, true, { original: "Segoe UI Variable", before: beforeFont });
      }
      if (st.sound_scheme) {
        const target = resolveSchemeGuid(st.sound_scheme);
        const beforeScheme = s.sounds.find((x) => x.current)?.guid ?? "";
        s.sounds = s.sounds.map((x) => ({ ...x, current: x.guid === target }));
        pushUndo("sound_scheme", `Sound scheme → ${target}`, true, { before: beforeScheme, after: target });
      }
      if (st.rgb) {
        notes.push("RGB not applied — no OpenRGB devices in preview");
      }
      if (st.mode) s.theme = { ...s.theme, mode: st.mode };
      if (st.accent_hex) s.theme = { ...s.theme, accent_hex: st.accent_hex, color_prevalence: true };
      if (typeof st.transparency === "boolean") s.theme = { ...s.theme, transparency: st.transparency };
      const wtype = st.wallpaper_type ?? "static";
      if (wtype === "scene" && st.scene) {
        s.engine = { active: true, frozen: false, scene: { ...st.scene }, media: null, static_wallpaper: s.engine.static_wallpaper || s.wallpaper.current };
      } else if (wtype === "live" && st.wallpaper) {
        // live wallpapers are video — engine.media, not a static image
        s.engine = {
          active: true,
          frozen: false,
          scene: null,
          media: { path: st.wallpaper, kind: "video", width: 1920, height: 1080, name: st.wallpaper.split("/").pop() ?? "media" },
          static_wallpaper: s.engine.static_wallpaper || s.wallpaper.current,
        };
      } else if (st.wallpaper) {
        s.wallpaper = { ...s.wallpaper, current: st.wallpaper };
        s.engine = { active: false, frozen: false, scene: null, media: null, static_wallpaper: "" };
      }
      pushUndo("style_applied", `Applied style: ${st.name}`, true, { before, style_id: st.id });
      return { ok: true, name: st.name, notes } as T;
    }
    case "get_applied_style": {
      const last = s.undo.find((u) => u.kind === "style_applied" && !u.undone);
      return ((last?.data.style_id as string) ?? null) as T;
    }
    default:
      return undefined;
  }
}
