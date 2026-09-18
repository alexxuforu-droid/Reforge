// Mock handlers: history & insights (undo log, snapshots, maintenance, profiles, dashboard, perf) — extracted from lib/mock.ts (V2 pillar 2a).
// Bodies are byte-identical to the original switch arms; this module only
// dispatches its own commands and returns undefined for anything else.
import type {
  AutomationConfig,
  EngineState,
  MaintenanceReport,
  PerfSnapshot,
  SceneConfig,
  Snapshot,
} from "../types";
import type { Store, MockCall } from "./store";
import { pushUndo, uid, clamp, perf } from "./store";

export async function handle<T>(cmd: string, s: Store, args: Record<string, unknown>, call: MockCall): Promise<T | undefined> {
  switch (cmd) {
    case "get_undo_log":
      return s.undo.map((e) => ({ ...e })) as T;
    case "get_performance": {
      perf.cpu = clamp(perf.cpu + (Math.random() - 0.5) * 14, 3, 96);
      perf.ramFree = clamp(perf.ramFree + (Math.random() - 0.5) * 6, 20, 88);
      return {
        ts: Date.now(),
        cpu_usage_pct: perf.cpu,
        ram_total: 32 * 1024 ** 3,
        ram_used: ((100 - perf.ramFree) / 100) * 32 * 1024 ** 3,
        ram_free_pct: perf.ramFree,
        process_count: 221,
        uptime_secs: 3 * 86400 + 4 * 3600,
        boot_time_ts: Date.now() / 1000 - (3 * 86400 + 4 * 3600),
        battery: { on_ac: true, percent: 92, charging: true },
        disks: [
          { name: "C:", mount: "C:\\", total: 223 * 1024 ** 3, free: 11 * 1024 ** 3, free_pct: 4.9 },
          { name: "D:", mount: "D:\\", total: 448 * 1024 ** 3, free: 109 * 1024 ** 3, free_pct: 24.3 },
        ],
        top_processes: [
          { name: "chrome.exe", mem_mb: 2841, cpu_pct: 6.2 },
          { name: "Discord.exe", mem_mb: 731, cpu_pct: 1.1 },
          { name: "Spotify.exe", mem_mb: 402, cpu_pct: 0.8 },
          { name: "explorer.exe", mem_mb: 289, cpu_pct: 2.3 },
          { name: "reforge.exe", mem_mb: 96, cpu_pct: 0.4 },
        ],
      } as T;
    }
    case "run_maintenance": {
      const rep: MaintenanceReport = {
        ts: Date.now(),
        junk_bytes: 11.2 * 1024 ** 3,
        junk_items: 8,
        duplicate_bytes: 3.4 * 1024 ** 3,
        duplicate_files: 3,
        startup_heavy: 2,
        storage_top: [],
        notes: [
          "Found 11.2 GB of junk across 8 areas (nothing deleted — clean from Tune-up).",
          "Duplicate sweep found 3.4 GB wasted across 3 groups (Desktop/Downloads/Documents).",
          "2 heavy startup entries (impact ≥ 7) — review in Tune-up → Startup.",
        ],
      };
      s.reports.unshift(rep);
      return rep as T;
    }
    case "list_reports":
      return s.reports.map((r) => ({ ...r })) as T;
    case "archive_report": {
      s.reports = s.reports.filter((r) => r.ts !== (args.ts as number));
      return "Report archived" as T;
    }
    case "export_profile":
      return {
        app: "reforge",
        format: 1,
        generated_at: Date.now(),
        theme: { accent_hex: s.theme.accent_hex, mode: s.theme.mode, transparency: s.theme.transparency },
        wallpaper: s.wallpaper.current,
        undo_count: s.undo.length,
      } as T;
    case "import_profile":
      pushUndo("accent", "[import] Profile applied", true, { before: s.theme.accent_hex, after: s.theme.accent_hex });
      return "Imported profile — applied: accent, mode" as T;
    case "revert_entry": {
      const e = s.undo.find((u) => u.id === args.id);
      if (!e) throw new Error("entry not found");
      if (e.kind === "accent") s.theme = { ...s.theme, accent_hex: (e.data.before as string) ?? "#000000" };
      if (e.kind === "mode") s.theme = { ...s.theme, mode: (e.data.before as "dark" | "light") ?? "dark" };
      if (e.kind === "transparency") s.theme = { ...s.theme, transparency: e.data.before as boolean };
      if (e.kind === "wallpaper") s.wallpaper = { ...s.wallpaper, current: (e.data.before as string) ?? "" };
      if (e.kind === "startup_disable") {
        const en = s.startup.find((x) => x.name === e.data.name);
        if (en) en.enabled = true;
      }
      if (e.kind === "blue_light") {
        // Mirrors undo.rs "blue_light": restore the prior on/off state; when
        // turning back on, the native side applies the default intensity ramp.
        const before = e.data.before as boolean;
        s.automation = { ...s.automation, blue_light_on: before, blue_light_intensity: before ? 0.3 : s.automation.blue_light_intensity };
      }
      if (e.kind === "animated_wallpaper") {
        // revert = stop the animation and restore the previous static wallpaper
        s.engine = { active: false, frozen: false, scene: null, media: null, static_wallpaper: (e.data.static_wallpaper as string) ?? "" };
      }
      if (e.kind === "animated_wallpaper_stop") {
        // revert = restart the scene that was stopped
        const scene = e.data.scene as SceneConfig | null;
        if (scene) s.engine = { ...s.engine, active: true, frozen: false, scene: { ...scene } };
      }
      if (e.kind === "style_applied") {
        const b = e.data.before as { accent?: string; mode?: string; transparency?: boolean; wallpaper?: string; engine?: EngineState; sound_scheme?: string; font?: { original?: string; before?: string } };
        if (b.accent) s.theme = { ...s.theme, accent_hex: b.accent };
        if (b.mode) s.theme = { ...s.theme, mode: b.mode as "dark" | "light" };
        if (typeof b.transparency === "boolean") s.theme = { ...s.theme, transparency: b.transparency };
        if (b.wallpaper !== undefined) s.wallpaper = { ...s.wallpaper, current: b.wallpaper };
        if (b.engine) s.engine = { active: b.engine.active, frozen: b.engine.frozen, scene: b.engine.scene, media: b.engine.media, static_wallpaper: b.engine.static_wallpaper };
        if (typeof b.sound_scheme === "string" && b.sound_scheme) s.sounds = s.sounds.map((x) => ({ ...x, current: x.guid === b.sound_scheme }));
        if (b.font?.original) {
          s.fonts = [...s.fonts.filter((f) => f.original !== b.font!.original), { original: b.font!.original, substituted: b.font!.before ?? "" }];
        }
      }
      if (e.kind === "marketplace_apply") {
        // Mirrors undo.rs "marketplace_apply": restore the pre-apply look
        // from the entry's before composite and unmark the pack.
        const b = (e.data.before ?? {}) as { accent?: string; mode?: string; wallpaper?: string };
        if (b.accent) s.theme = { ...s.theme, accent_hex: b.accent };
        if (b.mode) s.theme = { ...s.theme, mode: b.mode as "dark" | "light" };
        if (b.wallpaper !== undefined) s.wallpaper = { ...s.wallpaper, current: b.wallpaper };
        const applied = s.bundles.find((x) => x.id === (e.data.bundle_id as string));
        if (applied) applied.applied = false;
      }
      e.undone = true;
      return `Reverted: ${e.description}` as T;
    }
    case "snapshot_now": {
      const snap: Snapshot = { id: uid(), ts: Date.now(), state: { theme: { ...s.theme } } };
      s.snapshots.unshift(snap);
      pushUndo("snapshot", "Snapshot created (pre-makeover state)", false, { snapshot_id: snap.id });
      return snap as T;
    }
    case "list_snapshots":
      return s.snapshots.map((x) => ({ ...x })) as T;
    case "restore_snapshot":
      return "Restored snapshot" as T;
    case "factory_fresh":
      s.theme = { accent_hex: "#6D7CFF", mode: "dark", transparency: true, color_prevalence: true };
      s.wallpaper.current = "";
      return "Restored your pre-makeover state" as T;

    // ---- onboarding ----
    case "get_onboarding_state":
      return { ...s.onboarding } as T;
    case "set_onboarding_state":
      s.onboarding = { ...(args.onb as { wizard_seen: boolean }) };
      return null as T;

    // ---- style favorites (A2.1) ----
    case "get_favorites":
      return [...s.favorites] as T;
    case "set_favorite": {
      const id = String(args.id ?? "");
      const fav = Boolean(args.fav);
      const present = s.favorites.includes(id);
      if (fav && !present) s.favorites.push(id);
      else if (!fav) s.favorites = s.favorites.filter((x) => x !== id);
      return [...s.favorites] as T;
    }

    // ---- automation / perf / dashboard ----
    case "get_automation_config":
      return { ...s.automation } as T;
    case "set_automation_config": {
      s.automation = { ...(args.cfg as AutomationConfig) };
      return { ...s.automation } as T;
    }
    case "run_due_maintenance":
      return {
        ran_junk: true, junk_freed: 1.2 * 1024 ** 3, ran_dupes: false, dupe_wasted: 0, reapplied_theme: true,
        notes: ["Weekly junk clean freed 1.2 GB", "Re-applied saved accent color"],
      } as T;
    case "set_blue_light": {
      s.automation = { ...s.automation, blue_light_on: args.on as boolean, blue_light_intensity: args.intensity as number };
      pushUndo("blue_light", `Blue light filter → ${args.on ? "on" : "off"}`, true, { before: !args.on, after: args.on });
      return args.on as T;
    }
    case "get_dashboard_metrics": {
      const sFreed = s.freedSoFar + 3.4 * 1024 ** 3;
      const feats = [];
      if (s.engine.active) feats.push("Animated wallpaper");
      if (s.widgets.length) feats.push(`${s.widgets.length} desktop widget(s)`);
      if (s.macros.length) feats.push(`${s.macros.length} automation macro(s)`);
      if (s.automation.blue_light_on) feats.push("Blue light filter");
      feats.push("Custom accent #6D7CFF");
      return {
        personalization_score: Math.min(100, 40 + feats.length * 10),
        storage_freed: sFreed,
        files_organized: 14,
        time_saved_secs: 14 * 4 + Math.floor(sFreed / (1024 * 1024)) * 3,
        active_features: feats,
      } as T;
    }
    case "get_perf_history": {
      const now = Date.now();
      s.perfHistory = Array.from({ length: 30 }, (_, i) => ({
        ts: now - (29 - i) * 86400000,
        cpu_avg: 22 + Math.sin(i / 3) * 12 + Math.random() * 4,
        cpu_max: 38 + Math.sin(i / 2.4) * 18,
        ram_free_pct: 54 + Math.cos(i / 4) * 8,
      }));
      return s.perfHistory.map((r) => ({ ...r })) as T;
    }
    case "get_resource_leaderboard": {
      const snap = await call<PerfSnapshot>("get_performance");
      return snap.top_processes.map((p: { name: string; mem_mb: number; cpu_pct: number }) => ({ name: p.name, mem_mb: p.mem_mb * 4, cpu_pct: p.cpu_pct })) as T;
    }
    case "get_battery_health":
      return { available: true, design_mwh: 48000, full_mwh: 43100, health_pct: 90, cycle_count: 312 } as T;
    default:
      return undefined;
  }
}
