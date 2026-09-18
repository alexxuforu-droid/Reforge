// Mock handlers: tune-up & system (startup, health, bloat, power, network, vpn, updates infra, diagnostics) — extracted from lib/mock.ts (V2 pillar 2a).
// Bodies are byte-identical to the original switch arms; this module only
// dispatches its own commands and returns undefined for anything else.
import type {
  TranscodeConfig,
} from "../types";
import type { Store, MockCall } from "./store";
import { pushUndo } from "./store";

export async function handle<T>(cmd: string, s: Store, args: Record<string, unknown>, call: MockCall): Promise<T | undefined> {
  switch (cmd) {
    case "list_startup":
      return s.startup.map((e) => ({ ...e })) as T;
    case "toggle_startup": {
      const name = args.name as string;
      const enable = args.enable as boolean;
      const entry = s.startup.find((e) => e.name === name);
      if (entry) {
        entry.enabled = enable;
        pushUndo(
          enable ? "startup_enable" : "startup_disable",
          `${enable ? "Enabled" : "Disabled"} startup entry: ${name}`,
          true,
          { name, location: entry.location }
        );
      }
      return s.startup.map((e) => ({ ...e })) as T;
    }
    case "get_system_info":
      return {
        cpu_name: "AMD Ryzen 7 5800X 8-Core Processor",
        cpu_count: 16,
        cpu_usage_pct: 23.4,
        ram_total: 32 * 1024 ** 3,
        ram_used: 14.2 * 1024 ** 3,
        ram_free_pct: 55.6,
        os: "Microsoft Windows 11 Pro",
        host: "DESKTOP-REFORGE",
        disks: [
          { name: "C:", mount: "C:\\", total: 223 * 1024 ** 3, free: 11 * 1024 ** 3, free_pct: 4.9 },
          { name: "D:", mount: "D:\\", total: 448 * 1024 ** 3, free: 109 * 1024 ** 3, free_pct: 24.3 },
        ],
        top_processes: [
          { name: "chrome.exe", mem_mb: 2841, cpu_pct: 6.2 },
          { name: "Discord.exe", mem_mb: 731, cpu_pct: 1.1 },
          { name: "Spotify.exe", mem_mb: 402, cpu_pct: 0.8 },
          { name: "explorer.exe", mem_mb: 289, cpu_pct: 2.3 },
        ],
      } as T;
    case "get_health_score": {
      const disk = 4.9;
      const ram = 55.6;
      const startup = s.startup.filter((e) => e.enabled).length;
      const diskPts = Math.min(40, Math.max(0, Math.round(((disk - 15) / 40) * 40)));
      const ramPts = Math.min(15, Math.max(0, Math.round(((ram - 15) / 35) * 15)));
      const startupPts = Math.max(0, 20 - startup * 2);
      const cleanupPts = 0;
      const score = Math.min(100, diskPts + ramPts + startupPts + cleanupPts);
      return {
        score,
        disk_free_pct: disk,
        ram_free_pct: ram,
        startup_count: startup,
        last_cleanup_ts: s.undo.find((e) => e.kind === "junk_clean")?.ts ?? null,
        breakdown: [
          { label: "Disk space", points: diskPts, max: 40 },
          { label: "Startup clutter", points: startupPts, max: 20 },
          { label: "Memory pressure", points: ramPts, max: 15 },
          { label: "Recent cleanup", points: cleanupPts, max: 25 },
        ],
      } as T;
    }
    case "extract_palette":
      return ["#4A6CF7", "#0B1026", "#2A3B7C", "#9BB1FF"] as T;

    // ---- tune-up extras ----
    case "list_bloatware":
      return [
        { name: "Candy Crush Saga", publisher: "King", uninstall_string: "", hive: "HKCU", subkey: "", size_mb: 480 },
        { name: "Xbox Console Companion", publisher: "Microsoft", uninstall_string: "", hive: "HKLM", subkey: "", size_mb: 190 },
        { name: "Bing News", publisher: "Microsoft", uninstall_string: "", hive: "HKLM", subkey: "", size_mb: 74 },
        { name: "Clipchamp", publisher: "Microsoft", uninstall_string: "", hive: "HKCU", subkey: "", size_mb: 320 },
      ] as T;
    case "uninstall_bloatware":
      pushUndo("uninstall", `Launched uninstaller for ${args.name}`, false, { name: args.name });
      return `Launched uninstaller for ${args.name}` as T;
    case "get_memory_hogs":
      return [
        { name: "chrome.exe", pid: 4821, mem_mb: 2841, cpu_pct: 6.2 },
        { name: "Discord.exe", pid: 9034, mem_mb: 731, cpu_pct: 1.1 },
        { name: "Spotify.exe", pid: 3301, mem_mb: 402, cpu_pct: 0.8 },
        { name: "node.exe", pid: 2180, mem_mb: 366, cpu_pct: 2.4 },
        { name: "Code.exe", pid: 6410, mem_mb: 288, cpu_pct: 1.9 },
      ] as T;
    case "end_process":
      pushUndo("process_ended", `Ended process ${args.name} (PID ${args.pid})`, false, { name: args.name, pid: args.pid });
      return `Ended ${args.name}` as T;
    case "scan_orphaned_entries":
      return [
        { name: "Old Trial Software", hive: "HKLM", subkey: "...\\Uninstall\\{abc}", install_location: "C:\\Program Files\\OldTrial", reason: "InstallLocation missing: C:\\Program Files\\OldTrial" },
        { name: "Abandoned Tool 2019", hive: "HKCU", subkey: "...\\Uninstall\\abandoned", install_location: "", reason: "Uninstaller missing: C:\\OldTools\\uninstall.exe" },
      ] as T;
    case "remove_orphaned_entry":
      pushUndo("registry_cleanup", `Removed orphaned registry entry: ${args.name}`, true, { hive: args.hive, parent: "...", leaf: "...", backup: {} });
      return `Removed orphaned entry: ${args.name}` as T;
    case "list_power_plans":
      return [
        { name: "Balanced", guid: "381b4222-f694-41f0-9685-ff5bb260df2e", active: true },
        { name: "High performance", guid: "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c", active: false },
        { name: "Power saver", guid: "a1841308-3541-4fab-bc81-f71556f20b4a", active: false },
      ] as T;
    case "set_active_power_plan":
      pushUndo("power_plan", `Active power plan → ${args.name}`, true, { before_guid: "381b4222-f694-41f0-9685-ff5bb260df2e", before_name: "Balanced", after_guid: args.guid, after_name: args.name });
      return (await call("list_power_plans")) as T;
    case "audit_scheduled_tasks":
      return [
        { name: "OneDriveStandaloneUpdateTask", status: "Ready", trigger: "Daily", author: "Microsoft", risky: false },
        { name: "\u03b1updater.exe", status: "Ready", trigger: "At logon", author: "", risky: true },
        { name: "MicrosoftEdgeUpdateTask", status: "Ready", trigger: "At logon", author: "Microsoft", risky: false },
        { name: "crypto-miner-helper", status: "Ready", trigger: "At startup", author: "unknown", risky: true },
        { name: "NVIDIA GeForce Experience", status: "Ready", trigger: "At logon", author: "NVIDIA", risky: false },
      ] as T;
    case "get_boot_stats":
      return { last_boot_ms: 14800, trend_ms: 16400, samples: 12, available: true } as T;
    case "audit_browser_extensions":
      return [
        { browser: "Chrome", name: "uBlock Origin", version: "1.52.0", enabled: true, source: "web store" },
        { browser: "Chrome", name: "Untitled Extension", version: "0.1", enabled: false, source: "unknown" },
        { browser: "Edge", name: "Dark Reader", version: "4.9.62", enabled: true, source: "web store" },
        { browser: "Firefox", name: "Privacy Badger", version: "?", enabled: true, source: "unknown" },
      ] as T;
    case "audit_file_associations":
      return [
        { ext: ".html", prog_id: "ChromeHTML", handler: "user choice" },
        { ext: ".pdf", prog_id: "ChromePDF", handler: "user choice" },
        { ext: ".txt", prog_id: "txtfile", handler: "system default" },
        { ext: ".mp3", prog_id: "AppXq0fevzme2pys62n3e0fbqaeppe9c3kr", handler: "system default" },
      ] as T;
    case "reset_file_association":
      pushUndo("file_association", `Reset file association for ${args.ext}`, true, { ext: args.ext, backup: {} });
      return `${args.ext} will now open with the system default.` as T;
    case "list_drivers":
      return [
        { name: "oem10.inf", provider: "Realtek Semiconductor Corp.", version: "10.0.19041.1", date: "2/14/2023" },
        { name: "oem22.inf", provider: "NVIDIA", version: "31.0.15.5123", date: "6/1/2024" },
        { name: "oem41.inf", provider: "Intel", version: "12.0.0.2", date: "9/9/2022" },
      ] as T;

    // ---- network ----
    case "get_bandwidth_hogs":
      return [
        { name: "Steam.exe", pid: 9201, connections: 14 },
        { name: "chrome.exe", pid: 4821, connections: 41 },
        { name: "Discord.exe", pid: 9034, connections: 9 },
        { name: "Spotify.exe", pid: 3301, connections: 6 },
      ] as T;
    case "list_wifi_profiles":
      return [
        { name: "Home5G", backed_up: false },
        { name: "CoffeeShop WiFi", backed_up: false },
        { name: "Hotel-Guest", backed_up: false },
      ] as T;
    case "forget_wifi_profile": {
      pushUndo("wifi_forgot", `Forgot saved Wi-Fi network: ${args.name}`, true, { name: args.name, backup: "C:\\...\\wifi_backups\\profile.xml" });
      return `Forgot ${args.name}` as T;
    }
    case "reset_network": {
      pushUndo("network_reset", "Network reset — 4 of 5 steps succeeded", false, {});
      return {
        steps: [
          { name: "Flush DNS cache", ok: true, detail: "OK" },
          { name: "Release IP", ok: true, detail: "OK" },
          { name: "Renew IP", ok: true, detail: "OK" },
          { name: "Reset Winsock catalog", ok: true, detail: "OK" },
          { name: "Reset TCP/IP stack", ok: false, detail: "access denied (needs admin)" },
        ],
        backup: { backup_dir: "C:\\Users\\you\\AppData\\Roaming\\com.reforge\\network_backups\\123", files: ["ipconfig_all.txt", "netsh_ip_config.txt", "route_print.txt"] },
      } as T;
    }

    // ---- power (S10.1) ----
    case "get_power_state":
      return { ...s.power, plans: s.power.plans.map((p) => ({ ...p })), battery: s.power.battery ? { ...s.power.battery } : null, battery_health: s.power.battery_health ? { ...s.power.battery_health } : null } as T;
    case "set_power_plan": {
      const before = s.power.plans.find((p) => p.active)?.guid ?? "";
      pushUndo("power", "Power plan changed", true, { before: { plan_guid: before, screen_off_ac_min: s.power.screen_off_ac_min, screen_off_dc_min: s.power.screen_off_dc_min, hibernate_enabled: s.power.hibernate_enabled } });
      s.power.plans.forEach((p) => (p.active = p.guid === args.guid));
      return `Power plan changed` as T;
    }
    case "set_screen_off_timeout": {
      pushUndo("power", "Screen-off timeout changed", true, { before: { plan_guid: "", screen_off_ac_min: s.power.screen_off_ac_min, screen_off_dc_min: s.power.screen_off_dc_min, hibernate_enabled: s.power.hibernate_enabled } });
      s.power.screen_off_ac_min = args.ac_min as number;
      s.power.screen_off_dc_min = args.dc_min as number;
      return `Screen off updated` as T;
    }
    case "set_hibernate": {
      pushUndo("power", `Hibernate → ${args.enabled ? "on" : "off"}`, true, { before: { plan_guid: "", screen_off_ac_min: s.power.screen_off_ac_min, screen_off_dc_min: s.power.screen_off_dc_min, hibernate_enabled: s.power.hibernate_enabled } });
      s.power.hibernate_enabled = args.enabled as boolean;
      return `Hibernate ${args.enabled ? "enabled" : "disabled"}` as T;
    }

    // ---- network / VPN ----
    case "list_vpn_connections":
      return s.vpn.map((v) => ({ ...v })) as T;
    case "vpn_connect": {
      const v = s.vpn.find((x) => x.name === args.name);
      if (v) {
        pushUndo("vpn_connect", `Connected VPN: ${v.name}`, false, { name: v.name });
        v.status = "connected";
      }
      return s.vpn.map((v) => ({ ...v })) as T;
    }
    case "vpn_disconnect": {
      const v = s.vpn.find((x) => x.name === args.name);
      if (v) {
        pushUndo("vpn_disconnect", `Disconnected VPN: ${v.name}`, false, { name: v.name });
        v.status = "disconnected";
      }
      return s.vpn.map((v) => ({ ...v })) as T;
    }
    case "read_image_data_url":
      // 1x1 transparent PNG — enough for the browser preview to render the img.
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" as T;
    case "bundle_diagnostics":
      return "C:\\Users\\preview\\Downloads\\reforge-diagnostics-0.txt (browser preview)" as T;
    case "media_get_transcode_status":
      return { available: true, version: "ffmpeg version 6.1 (preview)", path: "resources/bin/ffmpeg.exe", max_import_bytes: 500 * 1024 * 1024, note: `Videos are normalized on import — preset: ${s.transcodeConfig.preset}.` } as T;
    case "get_transcode_config":
      return { ...s.transcodeConfig } as T;
    case "set_transcode_config": {
      const cfg = args.config as TranscodeConfig;
      s.transcodeConfig = { ...cfg };
      return { ...s.transcodeConfig } as T;
    }

    // ---- capability / transcode status ----
    case "get_capability_matrix":
      return {
        os_name: "Microsoft Windows 11 Pro",
        build: 26200,
        version_band: "win11_24h2",
        is_win11: true,
        admin: true,
        secure_boot: true,
        taskbar_reposition_supported: false,
        font_substitution_supported: true,
        lockscreen_policy_supported: true,
        boot_customization_supported: false,
        rgb_supported: false,
        video_wallpaper_supported: true,
        ffmpeg_available: true,
        elevation_required_reason: null,
      } as T;
    // ---- auto-updater (S12.1) ----
    case "list_config_files":
      // X-7 — mirrors system::config_inventory names so the preview shows
      // the same documented files (sizes are illustrative in preview).
      return [
        ["theme_state.json", "Accent, mode, transparency (Theme Studio)"],
        ["applied_style.json", "Currently applied style id (badge source)"],
        ["wallpaper_engine.json", "Animated engine + video wallpaper state"],
        ["wallpaper_history.json", "Wallpaper rotation history"],
        ["wallpaper_slideshow.json", "Slideshow folder, interval, shuffle"],
        ["custom_scenes.json", "Your Wallpaper Studio scenes"],
        ["widgets.json", "Desktop widget configs"],
        ["widgets_settings.json", "Widget board settings"],
        ["automation.json", "Schedules, blue light, style schedules"],
        ["undo_log.json", "Reversible change log (History)"],
        ["macros.json", "If-then automation macros"],
        ["clipboard_history.json", "Local clipboard history"],
        ["focus_session.json", "Focus session state"],
        ["smart_folders.json", "Smart folder definitions"],
        ["storage_config.json", "Safe-clean rules + exclusions"],
        ["display_profiles.json", "Saved display profiles"],
        ["gaming_profiles.json", "Per-game profiles"],
        ["screensaver.json", "Screensaver scene + timeout"],
        ["splash_config.json", "Welcome splash + launch-at-login"],
        ["pending_shell.json", "Queued taskbar changes (restart to apply)"],
        ["update_config.json", "Update channel + check-on-startup"],
        ["staged_update.json", "Downloaded, verified pending update"],
        ["scan_history.json", "Defender scan history"],
        ["boot_times.json", "Boot duration trend samples"],
        ["battery_health.json", "Cached battery health readout"],
        ["transcode_config.json", "Video import quality preset"],
        ["favorites.json", "Favorited styles"],
        ["perf_history.json", "Performance graph samples"],
        ["fun_widgets.json", "Fun overlay widgets + achievements"],
        ["onboarding.json", "Welcome wizard seen flag"],
        ["schema_version.json", "State migration version"],
      ].map(([name, description], i) => ({ name, description, exists: true, bytes: 512 + i * 128 })) as T;
    case "list_registry_values":
      // X-7 — mirrors system::REGISTRY_ALLOWLIST so the preview shows the
      // same four readable values.
      return [
        { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize", name: "AppsUseLightTheme", value: "0", kind: "DWORD" },
        { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize", name: "ColorPrevalence", value: "1", kind: "DWORD" },
        { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced", name: "TaskbarAl", value: "1", kind: "DWORD" },
        { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced", name: "TaskbarSi", value: "1", kind: "DWORD" },
      ] as T;
    default:
      return undefined;
  }
}
