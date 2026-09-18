// Mock handlers: safety & privacy (audit, permissions, browser privacy, usb, security center) — extracted from lib/mock.ts (V2 pillar 2a).
// Bodies are byte-identical to the original switch arms; this module only
// dispatches its own commands and returns undefined for anything else.
import type {

} from "../types";
import type { Store, MockCall } from "./store";
import { pushUndo } from "./store";

export async function handle<T>(cmd: string, s: Store, args: Record<string, unknown>, call: MockCall): Promise<T | undefined> {
  switch (cmd) {
    case "get_security_audit":
      return [
        { id: "ad_id", title: "Advertising ID", status: "warn", detail: "Windows can use an advertising ID to show tailored ads.", action_hint: "Disable in Settings → Privacy → General." },
        { id: "telemetry", title: "Diagnostic data", status: "info", detail: "Diagnostic data level not restricted by policy.", action_hint: "Set to 'Required' in Privacy → Diagnostics if you prefer." },
        { id: "startup_risk", title: "Startup bloat", status: "warn", detail: "2 of 6 startup entries look heavy (score ≥ 7).", action_hint: "Review in Tune-up → Startup manager." },
        { id: "wifi", title: "Saved Wi-Fi networks", status: "info", detail: "4 saved networks: Home5G, CoffeeShop, Gym, HotelWiFi", action_hint: "Forget old networks in Windows Settings." },
        { id: "firewall", title: "Windows Firewall", status: "ok", detail: "Domain · Private · Public profiles all ON", action_hint: "Nothing to do." },
        { id: "bloat", title: "Pre-installed bloatware", status: "warn", detail: "Found 2 apps that are commonly unwanted: Xbox (0 MB), Bing News (0 MB)", action_hint: "Uninstall via Settings → Apps." },
        { id: "usb_history", title: "Removable-device history", status: "info", detail: "Windows remembers USB drives you've plugged in.", action_hint: "Clear via Settings → Privacy → Clear activity history." },
      ] as T;

    // ---- security extras ----
    case "get_permissions":
      return [
        { id: "Microphone", label: "Microphone", allowed: true, apps: [{ name: "Discord", allowed: true }, { name: "Zoom", allowed: true }, { name: "Unknown app", allowed: false }] },
        { id: "Camera", label: "Camera", allowed: false, apps: [{ name: "Teams", allowed: true }, { name: "Camera", allowed: false }] },
        { id: "Location", label: "Location", allowed: true, apps: [{ name: "Maps", allowed: true }] },
      ] as T;
    case "set_permission": {
      pushUndo("permission", `${args.id} access → ${args.allowed ? "Allow" : "Deny"}`, true, { id: args.id, before: !args.allowed, after: args.allowed });
      return { id: args.id, label: args.id, allowed: args.allowed, apps: [] } as T;
    }
    case "get_browser_privacy":
      return [
        { id: "chrome-metrics", browser: "Chrome", label: "Usage metrics reporting", enabled: true, description: "Sends usage stats and crash reports." },
        { id: "chrome-3pck", browser: "Chrome", label: "Block third-party cookies", enabled: false, description: "Prevents cross-site tracking." },
        { id: "edge-metrics", browser: "Edge", label: "Usage metrics reporting", enabled: true, description: "Sends usage stats and crash reports." },
        { id: "edge-suggest", browser: "Edge", label: "Search suggestions", enabled: true, description: "Sends keystrokes for suggestions." },
      ] as T;
    case "set_browser_policy": {
      pushUndo("browser_policy", `${args.browser} ${args.policy} → ${args.enabled ? "on" : "off"}`, true, { browser: args.browser, policy: args.policy, before: args.enabled ? 1 : 0 });
      return (await call("get_browser_privacy")) as T;
    }
    case "get_usb_history":
      return [
        { name: "USB Mass Storage Device", vid: "0781", pid: "5581", first_seen: null },
        { name: "SanDisk Ultra USB Device", vid: "0781", pid: "5583", first_seen: null },
      ] as T;

    // ---- Windows Security Center mocks (B1) — preview parity with native ----
    case "security_get_health_status":
      return {
        overall_status: "healthy",
        antivirus: [{ name: "Microsoft Defender Antivirus", enabled: true, up_to_date: true }],
        firewall: [{ name: "Windows Defender Firewall", enabled: true }],
        third_party_active: false,
        tamper_protection_on: true,
        defender_detail: {
          real_time_protection_on: true,
          signature_age_days: 1,
          definitions_up_to_date: true,
          tamper_protection: true,
        },
      } as T;
    case "security_get_scan_history":
      return [
        { ts: Date.now() - 3600000, scan_type: "quick", result: "completed", threats_found: 0 },
        { ts: Date.now() - 86400000, scan_type: "full", result: "completed", threats_found: 0 },
        { ts: Date.now() - 86400000 * 6, scan_type: "quick", result: "completed", threats_found: 2 },
      ] as T;
    case "security_list_threats":
      return [] as T;
    case "security_audit_autorun_threat_surface":
      return [
        { name: "OneDriveStandaloneUpdateTask", location: "Task Scheduler", command: "OneDriveSetup.exe", flags: ["Microsoft-signed"], is_signed: true },
        { name: "crypto-miner-helper", location: "HKCU\\Run", command: "%AppData%\\crypto-helper\\miner.exe", flags: ["unsigned", "suspicious name"], is_signed: false },
      ] as T;
    case "security_get_cfa_status":
      return { mode: "disabled" } as T;
    case "security_list_asr_rules":
      return [
        { id: "asr-1", name: "Block executable content from email", action: "audit" },
        { id: "asr-2", name: "Block Office apps from creating child processes", action: "disabled" },
        { id: "asr-3", name: "Block credential stealing from Windows subsystem", action: "enabled" },
      ] as T;
    case "security_trigger_scan": {
      s.scanInProgress = true;
      setTimeout(() => { s.scanInProgress = false; }, 4000);
      return `Quick scan started (${args.scan_type ?? "quick"}) — results appear in the Security Center.` as T;
    }
    case "security_update_definitions":
      return "Definition update triggered — Defender is up to date." as T;
    case "security_restore_threat":
      return `Restored threat ${args.threat_id} from quarantine.` as T;
    case "security_remove_threat":
      return `Removed threat ${args.threat_id} permanently.` as T;
    case "security_set_cfa_mode":
      return { mode: args.mode as string } as T;
    case "security_set_asr_rule_action":
      return null as T;
    // ---- Phase 1 — Security Center commands that now have UI ----
    case "security_get_defender_detail":
      return {
        real_time_protection_on: true,
        last_scan_type: "quick",
        last_scan_time: new Date(Date.now() - 86400000).toISOString(),
        last_scan_result: "completed",
        signature_age_days: 1,
        definitions_up_to_date: true,
        definitions_age: "1 days",
        tamper_protection: true,
        behavior_monitor_on: true,
        nis_on: true,
        on_access_protection_on: true,
        ioav_protection_on: true,
      } as T;
    case "security_list_registered_products":
      return [
        { name: "Microsoft Defender Antivirus", product_kind: "antivirus", enabled: true, up_to_date: true, product_state_hex: "0x00001010" },
        { name: "Windows Defender Firewall", product_kind: "firewall", enabled: true, up_to_date: true, product_state_hex: "0x00001010" },
        { name: "Example AV Suite", product_kind: "antivirus", enabled: true, up_to_date: false, product_state_hex: "0x00000000" },
      ] as T;
    case "security_open_thirdparty_scanner":
      return "Opened Windows Security settings." as T;
    case "security_manage_exclusions": {
      const target = args.target as string;
      const kind = (args.kind as string) ?? "path";
      if (args.action === "add" && !s.exclusions.some((x) => x.target === target && x.kind === kind)) {
        s.exclusions.push({ target, kind });
      }
      if (args.action === "remove") {
        s.exclusions = s.exclusions.filter((x) => !(x.target === target && x.kind === kind));
      }
      return s.exclusions.map((x) => ({ ...x })) as T;
    }
    case "security_manage_cfa_allowlist":
      return `Added ${args.target} to the Controlled Folder Access ${args.is_folder ? "protected folders" : "allowed applications"} list.` as T;
    case "security_request_temporary_rt_disable": {
      const secs = (args.duration_secs as number) ?? 600;
      s.rtDisableUntil = Date.now() + secs * 1000;
      return `Real-time protection disabled for ${secs} seconds. It will re-enable automatically.` as T;
    }
    case "security_get_rt_disable_remaining_time": {
      const remaining = Math.max(0, Math.ceil((s.rtDisableUntil - Date.now()) / 1000));
      return { disabled: s.rtDisableUntil > Date.now(), remaining_secs: remaining } as T;
    }
    case "security_cancel_rt_disable_early":
      s.rtDisableUntil = 0;
      return "Real-time protection re-enabled." as T;
    case "security_get_scan_progress":
      return { in_progress: s.scanInProgress, progress: s.scanInProgress ? 50 : 100 } as T;
    case "security_get_digest":
      return {
        overall: "healthy",
        third_party_active: false,
        tamper_protection: true,
        recent_scans: [
          { ts: Date.now() - 3600000, scan_type: "quick", result: "completed", threats_found: 0 },
        ],
      } as T;
    case "security_get_threat_detail":
      return {
        ThreatID: Number(args.threat_id),
        ThreatName: "Win32/Example.Threat",
        SeverityID: 5,
        CategoryID: 1,
        FirstSeen: new Date(Date.now() - 86400000).toISOString(),
        Status: "Quarantined",
        Resources: ["C:\\Users\\you\\Downloads\\example.exe"],
      } as T;
    case "security_get_flagged_entry_detail":
      return {
        name: args.name,
        location: args.location,
        command: "C:\\example\\helper.exe",
        impact: 4,
        admin_required: false,
      } as T;
    default:
      return undefined;
  }
}
