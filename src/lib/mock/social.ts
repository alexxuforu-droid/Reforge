// Mock handlers: widgets, play (gaming, looks), productivity, modes, shell scenes, fun overlays — extracted from lib/mock.ts (V2 pillar 2a).
// Bodies are byte-identical to the original switch arms; this module only
// dispatches its own commands and returns undefined for anything else.
import type {
  MacroRule,
  ScreensaverConfig,
  WidgetConfig,
  WidgetsSettings,
  AccessibilityState,
  GameProfile,
} from "../types";
import type { Store } from "./store";
import { pushUndo, uid } from "./store";

export async function handle<T>(cmd: string, s: Store, args: Record<string, unknown>): Promise<T | undefined> {
  switch (cmd) {

    // ---- widgets ----
    case "list_widgets":
      return s.widgets.map((w) => ({ ...w })) as T;
    case "create_widget": {
      const w: WidgetConfig = {
        id: uid(),
        kind: args.kind as string,
        x: 60, y: 60,
        w: args.kind === "stats" ? 260 : args.kind === "clock" ? 190 : 240,
        h: args.kind === "clock" ? 96 : args.kind === "stats" ? 170 : 210,
        title: (args.kind as string).charAt(0).toUpperCase() + (args.kind as string).slice(1),
        content: "",
        visible: true,
        monitor: 0,
      };
      s.widgets.push(w);
      return { ...w } as T;
    }
    case "save_widget_layout": {
      const w = s.widgets.find((x) => x.id === args.id);
      if (w) {
        w.x = args.x as number;
        w.y = args.y as number;
        w.w = Math.max(120, args.w as number);
        w.h = Math.max(80, args.h as number);
        return { ...w } as T;
      }
      return null as T;
    }
    case "get_widgets_settings":
      return { ...s.widgetsSettings } as T;
    case "set_widgets_settings": {
      s.widgetsSettings = { ...s.widgetsSettings, ...(args.settings as Partial<WidgetsSettings>) };
      return { ...s.widgetsSettings } as T;
    }
    case "get_widget_stats":
      return {
        cpu: 23, ram_pct: 47, disk_free_pct: 31,
        gpu_name: "NVIDIA GeForce RTX 3060", gpu_usage: null,
        net_up_kbps: 128, net_down_kbps: 1240,
        thermal_c: 62,
      } as T;
    case "widget_open_view": {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("reforge:widget-nav", { detail: { view: args.view } }));
      }
      return null as T;
    }
    case "reset_widget_layout":
      s.widgets.forEach((w, i) => {
        w.x = 60 + (i % 3) * 40;
        w.y = 60 + Math.floor(i / 3) * 40;
      });
      return `Reset layout — ${s.widgets.length} widget(s) repositioned` as T;
    case "save_widget_note": {
      const w = s.widgets.find((x) => x.id === args.id);
      if (w) w.content = args.content as string;
      return null as T;
    }
    case "update_widget":
    case "set_widget_visible": {
      const w = s.widgets.find((x) => x.id === args.id);
      if (w) w.visible = args.visible as boolean;
      return null as T;
    }
    case "set_all_widgets_visible": {
      s.widgets.forEach((w) => (w.visible = args.visible as boolean));
      return null as T;
    }
    case "remove_widget": {
      s.widgets = s.widgets.filter((w) => w.id !== args.id);
      return null as T;
    }

    // ---- productivity ----
    case "get_clipboard_history":
      return s.clips.map((c) => ({ ...c })) as T;
    case "clear_clipboard_history": {
      s.clips = [];
      return null as T;
    }
    case "toggle_clipboard_pin": {
      const c = s.clips.find((x) => x.id === args.id);
      if (c) c.pinned = !c.pinned;
      return s.clips.map((x) => ({ ...x })) as T;
    }
    case "get_app_list":
      return [
        { name: "Discord", path: "C:\\Users\\you\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Discord.lnk" },
        { name: "Spotify", path: "...\\Spotify.lnk" },
        { name: "Visual Studio Code", path: "...\\Visual Studio Code.lnk" },
        { name: "Steam", path: "...\\Steam.lnk" },
        { name: "Brave", path: "...\\Brave.lnk" },
      ] as T;
    case "launch_app":
      return null as T;
    case "list_macros":
      return s.macros.map((m) => ({ ...m })) as T;
    case "create_macro": {
      const m: MacroRule = { id: uid(), name: args.name as string, when_app: (args.when_app as string).toLowerCase(), look_name: args.look_name as string, accent: args.accent as string, mode: args.mode as string, wallpaper: (args.wallpaper as string) || "", enabled: true };
      s.macros.push(m);
      pushUndo("macro", `Macro created: when ${m.when_app} starts → apply ${m.look_name}`, false, { macro: m });
      return { ...m } as T;
    }
    case "remove_macro": {
      s.macros = s.macros.filter((m) => m.id !== args.id);
      return null as T;
    }
    case "toggle_macro": {
      const m = s.macros.find((x) => x.id === args.id);
      if (m) m.enabled = args.enabled as boolean;
      return s.macros.map((x) => ({ ...x })) as T;
    }
    case "set_focus_mode": {
      pushUndo("focus_mode", `Focus mode ${args.on ? "on" : "off"}`, true, { before_hide: !args.on, hide: args.on });
      return (args.on ? "Focus mode on — desktop icons hidden" : "Focus mode off — icons restored") as T;
    }
    case "get_focus_state":
      return false as T;
    case "get_ram_cleanup":
      return { total_gb: 32, avail_gb: 17.8, load_pct: 44 } as T;

    // ---- gaming ----
    case "get_game_mode":
      return true as T;
    case "set_game_mode": {
      pushUndo("game_mode", `Game Mode → ${args.on ? "on" : "off"}`, true, { before: !args.on, after: args.on });
      return args.on as T;
    }
    case "list_game_profiles":
      return s.gameProfiles.map((p) => ({ ...p })) as T;
    case "save_game_profile": {
      const p = args.profile as GameProfile;
      const existing = s.gameProfiles.find((x) => x.id === p.id);
      if (existing) Object.assign(existing, p);
      else s.gameProfiles.push({ ...p, id: p.id || uid() });
      return { ...p, id: p.id || s.gameProfiles[s.gameProfiles.length - 1].id } as T;
    }
    case "delete_game_profile": {
      s.gameProfiles = s.gameProfiles.filter((x) => x.id !== args.id);
      return null as T;
    }
    case "list_app_look_rules":
      return s.appLooks.map((r) => ({ ...r })) as T;
    case "set_app_look_rules": {
      s.appLooks = ((args.rules ?? []) as { exe: string; look_id: string }[]).map((r) => ({ ...r }));
      return `Saved ${s.appLooks.length} per-app look rule${s.appLooks.length === 1 ? "" : "s"}.` as T;
    }
    case "apply_game_profile": {
      pushUndo("game_profile", `Applied ${(args.profile as GameProfile).name} profile`, true, { before: { game_mode: true, frozen: false, icons_hidden: false, taskbar_autohide: false } });
      return `${(args.profile as GameProfile).name} profile applied` as T;
    }

    // ---- focus sessions (S10.6) ----
    case "get_focus_session":
      return { ...s.focusSession } as T;
    case "start_focus_session": {
      const minutes = Math.max(5, args.minutes as number);
      s.focusSession = { active: true, ends_at_ts: Date.now() + minutes * 60_000, minutes, dnd_on: true };
      pushUndo("focus_session", `Focus session started — ${minutes} min`, true, { before_hide: false, before_toasts: true, ended: false });
      return { ...s.focusSession } as T;
    }
    case "stop_focus_session": {
      pushUndo("focus_session", "Focus session ended — desktop restored", true, { ended: true, minutes: s.focusSession.minutes });
      s.focusSession = { active: false, ends_at_ts: 0, minutes: 0, dnd_on: false };
      return `Focus session stopped — desktop restored` as T;
    }

    // ---- accessibility (S10.7) ----
    case "get_accessibility_state":
      return { ...s.accessibility, color_filter: { ...s.accessibility.color_filter } } as T;
    case "set_accessibility_state": {
      const a = s.accessibility;
      if (args.high_contrast !== undefined) a.high_contrast = args.high_contrast as boolean;
      if (args.animations_off !== undefined) a.animations_off = args.animations_off as boolean;
      if (args.cursor_size !== undefined) a.cursor_size = args.cursor_size as number;
      if (args.text_scale_pct !== undefined) a.text_scale_pct = args.text_scale_pct as number;
      if (args.color_filter !== undefined) a.color_filter = { ...(args.color_filter as object) } as AccessibilityState["color_filter"];
      pushUndo("accessibility", "Accessibility settings changed", true, { before: { high_contrast: false, animations_off: false, cursor_size: 32, text_scale_pct: 100, color_filter: { active: false, filter_type: 0 } } });
      return { ...a, color_filter: { ...a.color_filter } } as T;
    }
    case "get_stream_layout":
      return { icons_hidden: false, taskbar_autohide: false } as T;
    case "set_stream_layout": {
      pushUndo("stream_layout", `Stream-safe layout → ${args.on ? "on" : "off"}`, true, { before: { icons_hidden: false, taskbar_autohide: false }, after: args.on });
      return { icons_hidden: args.on, taskbar_autohide: args.on } as T;
    }

    // ---- screensaver (E4.6) ----
    case "get_screensaver_config":
      return { ...s.screensaver, scene: s.screensaver.scene ? { ...s.screensaver.scene } : null } as T;
    case "set_screensaver_config": {
      const cfg = args.config as ScreensaverConfig;
      s.screensaver = {
        enabled: !!cfg.enabled,
        timeout_secs: Math.max(1, cfg.timeout_secs),
        scene: cfg.scene ? { ...cfg.scene } : null,
      };
      s.screensaverRegistry = { active: s.screensaver.enabled, timeout_secs: s.screensaver.timeout_secs };
      return { ...s.screensaver, scene: s.screensaver.scene ? { ...s.screensaver.scene } : null } as T;
    }
    case "get_screensaver_registry":
      return { ...s.screensaverRegistry } as T;
    case "preview_screensaver": {
      s.screensaverPreviewedAt = Date.now();
      return "Screensaver preview — move the mouse or press any key to exit" as T;
    }
    case "dismiss_screensaver":
      return null as T;

    // ---- taskbar (shell) ----
    case "shell_get_taskbar_state":
      return { ...s.taskbar } as T;
    case "shell_set_taskbar_size": {
      const before = s.taskbar.size;
      s.taskbar = { ...s.taskbar, size: args.size as string };
      pushUndo("taskbar_size", `Taskbar icon size → ${args.size}`, true, { before, after: args.size });
      return { ...s.taskbar } as T;
    }
    case "shell_set_taskbar_alignment": {
      const before = s.taskbar.alignment;
      s.taskbar = { ...s.taskbar, alignment: args.align as string };
      pushUndo("taskbar_alignment", `Taskbar alignment → ${args.align}`, true, { before, after: args.align });
      return { ...s.taskbar } as T;
    }
    case "shell_set_taskbar_autohide": {
      const before = s.taskbar.autohide;
      s.taskbar = { ...s.taskbar, autohide: args.on as boolean };
      pushUndo("taskbar_autohide", `Taskbar auto-hide ${args.on ? "on" : "off"}`, true, { before, after: args.on });
      return { ...s.taskbar } as T;
    }
    case "shell_set_taskbar_color_match": {
      const before = s.taskbar.color_match;
      s.taskbar = { ...s.taskbar, color_match: args.on as boolean };
      pushUndo("taskbar_color_match", `Taskbar color-match ${args.on ? "on" : "off"}`, true, { before, after: args.on });
      return { ...s.taskbar } as T;
    }
    case "shell_set_taskbar_position": {
      pushUndo("taskbar_position", `Taskbar moved to ${args.side}`, true, { side: args.side, before_bytes: null });
      return `Taskbar moved to ${args.side} (applies after the shell refresh)` as T;
    }
    case "shell_get_pending_state":
      return { pending: false, changes: [], explorer_running: true } as T;
    case "shell_apply_pending_restart":
      return "Explorer restarted — applied queued change(s)." as T;
    case "shell_revert_pending":
      return "Reverted all pending shell changes to the last known good state." as T;
    // ---- Phase 1 — splash + taskbar capabilities (splash.rs / shell.rs) ----
    case "get_splash_config":
      return { ...s.splash } as T;
    case "set_splash_config": {
      s.splash = { ...(args.config as typeof s.splash) };
      return { ...s.splash } as T;
    }
    case "set_splash_login_launch":
      s.splash = { ...s.splash, launch_at_login: args.on as boolean };
      return s.splash.launch_at_login as T;
    case "dismiss_splash":
      return null as T;
    case "shell_get_taskbar_capabilities":
      return {
        reposition_supported: false,
        size_supported: true,
        alignment_supported: true,
        autohide_supported: true,
        color_match_supported: true,
        is_win11: true,
        note: "Windows 11 removed the ability to move the taskbar to the top/side. Position controls are hidden.",
      } as T;
    // ---- RGB (E7.9): mock parity with rgb.rs so preview matches desktop ----
    case "rgb_detect":
      return { available: false, devices: [], note: "No RGB devices in browser preview — run the desktop app to detect OpenRGB devices." } as T;
    case "rgb_set_static":
      return `Set RGB device ${args.device_index ?? 0} to ${args.hex}` as T;
    case "rgb_restore_current_mode":
      return `Restored RGB device ${args.device_index ?? 0} to its current mode` as T;
    case "rgb_set_zone_static":
      return `Set RGB device ${args.device_index ?? 0} zone ${args.zone_index ?? 0} to ${args.hex}` as T;
    // ---- Widgets hub (fun module) — mock parity with fun/*.rs ----
    case "fun_get_state":
      return {
        enabled: [...s.fun.enabled],
        configs: JSON.parse(JSON.stringify(s.fun.configs)),
        achievements: [...s.fun.achievements],
        counts: { ...s.fun.counts },
      } as T;
    case "fun_set_enabled": {
      const id = args.id as string;
      const on = args.on as boolean;
      if (on && !s.fun.enabled.includes(id)) s.fun.enabled.push(id);
      if (!on) s.fun.enabled = s.fun.enabled.filter((e) => e !== id);
      return {
        enabled: [...s.fun.enabled],
        configs: JSON.parse(JSON.stringify(s.fun.configs)),
        achievements: [...s.fun.achievements],
        counts: { ...s.fun.counts },
      } as T;
    }
    case "fun_set_config": {
      const id = args.id as string;
      const patch = (args.patch ?? {}) as Record<string, unknown>;
      s.fun.configs[id] = { ...(s.fun.configs[id] ?? {}), ...patch };
      return {
        enabled: [...s.fun.enabled],
        configs: JSON.parse(JSON.stringify(s.fun.configs)),
        achievements: [...s.fun.achievements],
        counts: { ...s.fun.counts },
      } as T;
    }
    case "fun_bump_count": {
      const key = args.key as string;
      const n = (args.n as number) ?? 1;
      s.fun.counts[key] = (s.fun.counts[key] ?? 0) + n;
      return s.fun.counts[key] as T;
    }
    case "fun_unlock_achievement": {
      const id = args.id as string;
      if (s.fun.achievements.includes(id)) return false as T;
      s.fun.achievements.push(id);
      return true as T;
    }
    case "fun_get_stats":
      return {
        cpu: 12 + Math.random() * 30,
        ram_pct: 46 + Math.random() * 12,
        mem_used: 8_200_000_000,
        mem_total: 16_000_000_000,
        disk_pct: 61,
        proc_count: 148,
        uptime_secs: 3 * 3600 + 1200,
        idle_secs: 90,
        top_procs: [
          { name: "reforge.exe", cpu: 4.2 },
          { name: "explorer.exe", cpu: 2.1 },
          { name: "steam.exe", cpu: 1.4 },
        ],
      } as T;
    case "fun_capture_screen":
      // 1×1 transparent PNG (browser preview has no screen to capture)
      return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" as T;
    case "fun_save_png":
      return `${args.filename ?? "image.png"} (saved — browser preview has no real Downloads folder)` as T;
    case "fun_spawn_overlay":
    case "fun_close_overlay":
      return null as T;
    case "fun_hotkey_state":
      return {} as T;
    default:
      return undefined;
  }
}
