// Mock handlers: sharing & lifecycle (marketplace packs, updater, context-menu verbs) — extracted from lib/mock.ts (V2 pillar 2a).
// Bodies are byte-identical to the original switch arms; this module only
// dispatches its own commands and returns undefined for anything else.
import type {
  BundleInfo,
  BundleManifest,
  UpdateConfig,
  UpdateCheck,
  StagedUpdate,
} from "../types";
import type { Store } from "./store";
import { pushUndo, uid } from "./store";

export async function handle<T>(cmd: string, s: Store, args: Record<string, unknown>): Promise<T | undefined> {
  switch (cmd) {

    // ---- marketplace ----
    case "marketplace_list_bundles":
      return s.bundles.map((b) => ({ ...b })) as T;
    case "marketplace_import": {
      const name = String(args.source ?? "").split(/[\\/]/).pop() || "imported-pack";
      const id = "pack-" + uid();
      const b: BundleInfo = { id, name: name.replace(/\.reforgepack$/i, ""), version: "1.0", author: "Imported", description: "Imported from disk — components listed in Preview.", component_count: 3, applied: false, applied_count: 0 };
      s.bundles.push(b);
      s.manifests.set(id, { id, name: b.name, version: "1.0", author: "Imported", description: b.description, thumbnail: "", components: [{ type: "accent", hex: "#6D7CFF" }, { type: "theme_mode", mode: "dark" }, { type: "wallpaper", asset: "wp.png" }] });
      return { ...b } as T;
    }
    case "marketplace_export_look": {
      const id = "look-" + uid();
      const b: BundleInfo = { id, name: (args.name as string) || "My Look", version: "1.0", author: "Reforge User", description: "A snapshot of your current look captured in one click.", component_count: 4, applied: false, applied_count: 0 };
      s.bundles.push(b);
      s.manifests.set(id, { id, name: b.name, version: "1.0", author: "Reforge User", description: b.description, thumbnail: "", components: [{ type: "accent", hex: s.theme.accent_hex }, { type: "theme_mode", mode: s.theme.mode }, { type: "wallpaper", asset: "wp.png" }, { type: "taskbar", size: "medium" }] });
      return { ...b } as T;
    }
    case "marketplace_export_to_path":
      return `Exported to ${args.out_path}` as T;
    case "marketplace_apply_bundle": {
      const b = s.bundles.find((x) => x.id === args.bundle_id);
      if (!b) throw new Error("Pack not found");
      // Snapshot the pre-apply look BEFORE mutating (mirrors the Rust
      // undo entry's before composite) so revert_entry can restore it.
      const beforeLook = { accent: s.theme.accent_hex, mode: s.theme.mode, wallpaper: s.wallpaper.current };
      b.applied = true;
      b.applied_count = (b.applied_count ?? 0) + 1;
      const m = s.manifests.get(b.id);
      if (m) {
        const accent = m.components.find((c) => c.type === "accent");
        if (accent?.hex) s.theme = { ...s.theme, accent_hex: accent.hex, color_prevalence: true };
        const mode = m.components.find((c) => c.type === "theme_mode");
        if (mode?.mode) s.theme = { ...s.theme, mode: mode.mode as "dark" | "light" };
      }
      pushUndo("marketplace_apply", `Applied pack: ${b.name}`, true, {
        bundle_id: b.id,
        before: beforeLook,
      });
      return `Applied pack '${b.name}' (${b.component_count} components). Revert from History.` as T;
    }
    case "marketplace_get_manifest": {
      const m = s.manifests.get(args.bundle_id as string);
      if (!m) throw new Error("Pack manifest not found");
      return JSON.parse(JSON.stringify(m)) as T;
    }
    case "marketplace_delete_bundle": {
      s.bundles = s.bundles.filter((b) => b.id !== args.bundle_id);
      s.manifests.delete(args.bundle_id as string);
      return null as T;
    }
    case "marketplace_preview_asset":
      // 1x1 transparent PNG — enough for the browser preview to render the img.
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" as T;
    case "marketplace_import_components": {
      const id = "code-" + uid();
      const b: BundleInfo = {
        id,
        name: String(args.name ?? "Shared Look"),
        version: "1.0",
        author: "Shared code",
        description: "Imported from a share code — the declarative look, no media files.",
        component_count: (args.components as unknown[]).length,
        applied: false,
        applied_count: 0,
      };
      s.bundles.push(b);
      s.manifests.set(id, { id, name: b.name, version: "1.0", author: "Shared code", description: b.description, thumbnail: "", schema_version: 2, components: args.components as BundleManifest["components"] });
      return { ...b } as T;
    }
    case "get_update_config": {
      // Normalize with defaults so a config persisted before check_on_startup
      // existed never surfaces `undefined` to the UI.
      const dflt = { manifest_url: "https://reforge.app/releases/latest.json", check_on_startup: false };
      return { ...dflt, ...s.updateConfig } as T;
    }
    case "set_update_config": {
      const dflt = { manifest_url: "https://reforge.app/releases/latest.json", check_on_startup: false };
      s.updateConfig = { ...dflt, ...(args.cfg as UpdateConfig) };
      return { ...s.updateConfig } as T;
    }
    case "check_for_update": {
      // Browser preview has no network — mirror the honest "error" branch so
      // the UI exercises the real offline path, and let tests inject a
      // manifest via set_update_config + a stub flag (see api.test.ts).
      if (s.mockUpdateResult) return { ...s.mockUpdateResult } as T;
      return {
        state: "error",
        current: "1.0.0",
        latest: null,
        url: null,
        sha256: null,
        notes: [],
        message: "could not reach the update server (preview mode has no network)",
      } as T;
    }
    case "download_update": {
      if (!s.mockUpdateResult || s.mockUpdateResult.state !== "update-available") {
        throw new Error("no update available to download");
      }
      const staged: StagedUpdate = {
        version: args.version as string,
        path: `%APPDATA%\\com.reforge.app\\updates\\reforge-${args.version}.exe`,
        bytes: 318 * 1024 * 1024,
        downloaded_at: Date.now(),
      };
      s.stagedUpdate = staged;
      return staged as T;
    }
    case "apply_staged_update": {
      if (!s.stagedUpdate) throw new Error("No staged update found — download one first");
      return `Update ${s.stagedUpdate.version} is staged and verified at ${s.stagedUpdate.path} — production installs it silently on the next launch via the NSIS installer.` as T;
    }
    // ---- test hook (mock-only — never in Rust, so arg-parity ignores it) ----
    case "mock_set_update_result": {
      s.mockUpdateResult = (args.result ?? null) as UpdateCheck | null;
      s.stagedUpdate = null; // reset the stage too, so tests start clean
      return null as T;
    }
    case "take_launch_view":
      // D1 — browser preview never launches with --view; always open normally.
      return null as T;
    case "install_context_menu":
      pushUndo("context_menu_added", "Added Reforge verbs to the desktop right-click menu", true, {});
      return "Desktop right-click verbs installed — revert anytime from History." as T;
    case "remove_context_menu":
      pushUndo("context_menu_removed", "Removed Reforge verbs from the desktop right-click menu", true, {});
      return "Desktop right-click verbs removed." as T;
    default:
      return undefined;
  }
}
