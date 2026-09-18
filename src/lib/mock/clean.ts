// Mock handlers: cleanup & organizing (junk, storage radar, duplicates, smart folders, archive/rename) — extracted from lib/mock.ts (V2 pillar 2a).
// Bodies are byte-identical to the original switch arms; this module only
// dispatches its own commands and returns undefined for anything else.
import type {
  MoveOp,
  SmartFolder,
  StorageConfig,
} from "../types";
import type { Store, MockCall } from "./store";
import { pushUndo, uid, safeCleanItems, MB, BIGGEST_FIXTURES, UNUSED_FIXTURES, BIG_DUPE_FIXTURES, store } from "./store";
import { fmt } from "../format";

export async function handle<T>(cmd: string, s: Store, args: Record<string, unknown>, call: MockCall): Promise<T | undefined> {
  switch (cmd) {
    case "scan_junk":
      return { items: s.junk.map((j) => ({ ...j })), total_bytes: s.junk.reduce((a, j) => a + j.size, 0), scanned_at: Date.now() } as T;
    case "clean_junk": {
      const ids = new Set(args.ids as string[]);
      let freed = 0;
      let deleted = 0;
      const skipped: string[] = [];
      s.junk = s.junk.filter((j) => {
        if (!ids.has(j.id)) return true;
        if (j.admin_required) {
          skipped.push(j.label);
          return true;
        }
        freed += j.size;
        deleted += j.file_count;
        return false;
      });
      s.freedSoFar += freed;
      pushUndo("junk_clean", `Cleaned ${fmt(freed)} of junk (${deleted} files)`, false, { freed, deleted });
      return { freed_bytes: freed, deleted_count: deleted, failed: [], skipped_admin: skipped } as T;
    }
    // ---- S14 storage liberation ----
    case "scan_storage_radar":
      return [
        {
          label: "C:", mount: "C:\\", total: 512_000_000_000, free: 96_400_000_000, used: 415_600_000_000,
          top_level: [
            { name: "Windows", path: "C:\\Windows", size: 38_200_000_000, file_count: 112_000 },
            { name: "Users", path: "C:\\Users", size: 210_500_000_000, file_count: 480_000 },
            { name: "Program Files", path: "C:\\Program Files", size: 62_800_000_000, file_count: 92_000 },
            { name: "ProgramData", path: "C:\\ProgramData", size: 24_900_000_000, file_count: 61_000 },
          ],
        },
        {
          label: "D:", mount: "D:\\", total: 1_000_000_000_000, free: 812_000_000_000, used: 188_000_000_000,
          top_level: [
            { name: "Games", path: "D:\\Games", size: 140_000_000_000, file_count: 220_000 },
            { name: "Media", path: "D:\\Media", size: 31_000_000_000, file_count: 8_400 },
          ],
        },
      ] as T;
    case "scan_biggest_files": {
      const dir = String(args.dir ?? "");
      const topN = (args.top_n as number) ?? 10;
      const minMb = (args.min_mb as number) ?? 50;
      const files = BIGGEST_FIXTURES.filter((f) => f.path.startsWith(dir) && f.size >= minMb * MB)
        .sort((a, b) => b.size - a.size)
        .slice(0, topN);
      return files.map((f) => ({ ...f })) as T;
    }
    case "get_storage_config":
      return { ...s.storageConfig } as T;
    case "set_storage_config": {
      s.storageConfig = { ...(args.cfg as StorageConfig) };
      return { ...s.storageConfig } as T;
    }
    case "preview_clean_now":
      return safeCleanItems() as T;
    case "clean_now": {
      const ids = new Set(args.ids as string[]);
      const items = safeCleanItems().filter((i) => ids.has(i.id));
      const dry = s.storageConfig.dry_run;
      let freed = 0;
      let deleted = 0;
      const failed: string[] = [];
      const skipped_admin: string[] = [];
      const categories: { label: string; freed: number }[] = [];
      for (const it of items) {
        if (dry) {
          freed += it.size;
          continue;
        }
        if (it.id === "recycle_bin") {
          s.recycleBinSize = 0;
          freed += it.size;
          deleted += 1;
        } else if (it.admin_required) {
          skipped_admin.push(it.label);
          continue;
        } else {
          freed += it.size;
          deleted += it.file_count;
          s.junk = s.junk.filter((j) => j.id !== it.id);
        }
        const cat = categories.find((c) => c.label === it.label);
        if (cat) cat.freed += it.size;
        else categories.push({ label: it.label, freed: it.size });
      }
      if (!dry) {
        pushUndo("storage_clean", `Safe clean freed ${fmt(freed)} (${deleted} items)`, false, {
          freed, deleted, dry_run: false, at: Date.now(), categories, skipped: [...failed, ...skipped_admin],
        });
        s.freedSoFar += freed;
      }
      return { freed_bytes: freed, deleted_count: deleted, failed, skipped_admin } as T;
    }
    case "scan_unused": {
      const dir = String(args.dir ?? "");
      const days = (args.older_than_days as number) ?? 180;
      const minMb = (args.min_mb as number) ?? 10;
      const files = UNUSED_FIXTURES.filter((f) => f.path.startsWith(dir) && f.days_old >= days && f.size >= minMb * MB);
      s.unusedFiles = files.map((f) => ({ ...f }));
      return s.unusedFiles.map((f) => ({ ...f })) as T;
    }
    case "delete_unused": {
      const paths = new Set(args.paths as string[]);
      let freed = 0;
      s.unusedFiles = s.unusedFiles.filter((u) => {
        if (!paths.has(u.path)) return true;
        freed += u.size;
        return false;
      });
      if (freed > 0) {
        pushUndo("storage_clean", `Moved ${paths.size} unused file(s) to the staging trash — freed ${fmt(freed)}`, true, {
          freed, deleted: paths.size, dry_run: false, at: Date.now(), categories: [], skipped: [],
        });
        s.freedSoFar += freed;
      }
      return freed as T;
    }
    case "recycle_bin_state":
      return { size: s.recycleBinSize, empty: s.recycleBinSize === 0 } as T;
    case "empty_recycle_bin": {
      const size = s.recycleBinSize;
      s.recycleBinSize = 0;
      pushUndo("storage_clean", `Emptied the Recycle Bin (freed ${fmt(size)})`, false, { freed: size, at: Date.now() });
      s.freedSoFar += size;
      return `Recycle Bin emptied — freed ${fmt(size)}` as T;
    }
    case "windows_old_info":
      return {
        exists: true,
        size: 31_500_000_000,
        note: "Files from your previous Windows install. Removing it is permanent and can't be undone — keep it until you're sure nothing you need is inside.",
      } as T;
    case "swap_file_sizes":
      return [
        { name: "hiberfil.sys", path: "C:\\hiberfil.sys", size: 9_800_000_000, note: "Used by Hibernate / Fast Startup. Managed by Windows — disable hibernation in Power settings to remove it." },
        { name: "pagefile.sys", path: "C:\\pagefile.sys", size: 8_200_000_000, note: "The virtual-memory page file. Managed by Windows — disable it only via Advanced system settings." },
      ] as T;
    case "big_dupe_groups": {
      const minMb = (args.min_mb as number) ?? 500;
      return BIG_DUPE_FIXTURES.filter((g) => g.wasted_bytes >= minMb * MB).map((g) => ({ ...g })) as T;
    }
    // S14 test hook (mock-only — never in Rust, so arg-parity ignores it)
    case "mock_reset_storage": {
      s.storageConfig = {
        unused_days: 180, unused_min_mb: 10, safe_temp: true, safe_update_cache: true, safe_recycle_bin: true,
        safe_browser_caches: true, safe_installers: true, exclusions: [], dry_run: true, auto_clean: "off",
      } as StorageConfig;
      s.recycleBinSize = 2_400_000_000;
      s.unusedFiles = [];
      return null as T;
    }
    case "get_user_folders":
      return [
        { label: "Home", path: "C:\\Users\\you", exists: true },
        { label: "Desktop", path: "C:\\Users\\you\\Desktop", exists: true },
        { label: "Documents", path: "C:\\Users\\you\\Documents", exists: true },
        { label: "Downloads", path: "C:\\Users\\you\\Downloads", exists: true },
        { label: "Pictures", path: "C:\\Users\\you\\Pictures", exists: true },
        { label: "OneDrive", path: "C:\\Users\\you\\OneDrive", exists: true },
      ] as T;
    case "scan_duplicates":
      return {
        scanned_bytes: 48 * 1024 ** 3,
        total_wasted: 3.4 * 1024 ** 3,
        groups: [
          { id: "dup-1", name: "IMG_2041.JPG", size: 4.2 * 1024 ** 2, files: [
            { path: `${args.dir}\\IMG_2041.JPG`, modified: Date.now() / 1000 - 3600 },
            { path: `${args.dir}\\Photos\\IMG_2041.JPG`, modified: Date.now() / 1000 - 86400 },
            { path: `${args.dir}\\New folder\\IMG_2041 (2).JPG`, modified: Date.now() / 1000 - 172800 },
          ]},
          { id: "dup-2", name: "project_final.zip", size: 812 * 1024 ** 2, files: [
            { path: `${args.dir}\\project_final.zip`, modified: Date.now() / 1000 - 7200 },
            { path: `${args.dir}\\Downloads\\project_final (1).zip`, modified: Date.now() / 1000 - 36000 },
          ]},
          { id: "dup-3", name: "setup_v2.exe", size: 248 * 1024 ** 2, files: [
            { path: `${args.dir}\\setup_v2.exe`, modified: Date.now() / 1000 - 500 },
            { path: `${args.dir}\\Old builds\\setup_v2.exe`, modified: Date.now() / 1000 - 900000 },
          ]},
        ],
      } as T;
    case "remove_duplicates": {
      const n = (args.paths as string[]).length;
      store.stagingTrashBytes += n * 2_400_000;
      pushUndo("duplicates_removed", `Moved ${n} duplicate files to staging trash`, true, {
        moved: (args.paths as string[]).map((p) => ({ from: p, to: `${p}.reforge-trash` })),
      });
      return `Moved ${n} files to staging trash (reversible)` as T;
    }
    case "resolve_duplicate_group": {
      // D2 — mirrors duplicates::pick_removals survivor rules for preview.
      const group = args.group as { files: { path: string; modified: number }[] };
      const rule = args.rule as string | { folder: string };
      const files = group.files ?? [];
      if (files.length < 2) return [] as T;
      const ruleName = typeof rule === "string" ? rule : "InFolder";
      const folder = typeof rule === "object" ? (rule.folder as string) : "";
      const survivor = ruleName === "Newest"
        ? files.reduce((a, b) => (b.modified > a.modified ? b : a))
        : ruleName === "Oldest"
          ? files.reduce((a, b) => (b.modified < a.modified ? b : a))
          : files.find((f) => f.path.startsWith(folder));
      if (!survivor) throw new Error("No survivor matched the rule.");
      return files.filter((f) => f.path !== survivor.path).map((f) => f.path) as T;
    }
    case "empty_trash":
      pushUndo("trash_emptied", "Permanently deleted staged duplicates", false, { freed: store.stagingTrashBytes });
      store.stagingTrashBytes = 0;
      return "Emptied staging trash — trash is now empty" as T;
    case "trash_size":
      return store.stagingTrashBytes as T;
    case "scan_storage":
      return [
        { name: "Downloads", path: `${args.dir}\\Downloads`, size: 18.2 * 1024 ** 3, file_count: 4120 },
        { name: "Documents", path: `${args.dir}\\Documents`, size: 12.6 * 1024 ** 3, file_count: 2880 },
        { name: "Videos", path: `${args.dir}\\Videos`, size: 41.3 * 1024 ** 3, file_count: 210 },
        { name: "Pictures", path: `${args.dir}\\Pictures`, size: 9.8 * 1024 ** 3, file_count: 1150 },
        { name: "Desktop", path: `${args.dir}\\Desktop`, size: 4.1 * 1024 ** 3, file_count: 342 },
        { name: "Music", path: `${args.dir}\\Music`, size: 6.7 * 1024 ** 3, file_count: 890 },
      ] as T;
    case "preview_sort":
      return [
        { from: `${args.dir}\\report.pdf`, to: `${args.dir}\\Documents\\report.pdf` },
        { from: `${args.dir}\\photo.jpg`, to: `${args.dir}\\Images\\photo.jpg` },
        { from: `${args.dir}\\clip.mp4`, to: `${args.dir}\\Videos\\clip.mp4` },
        { from: `${args.dir}\\archive.zip`, to: `${args.dir}\\Archives\\archive.zip` },
        { from: `${args.dir}\\song.mp3`, to: `${args.dir}\\Audio\\song.mp3` },
        { from: `${args.dir}\\notes.txt`, to: `${args.dir}\\Documents\\notes.txt` },
      ] as T;
    case "apply_sort": {
      const plan = (await call<MoveOp[]>("preview_sort", args));
      pushUndo("sort", `Auto-sorted ${plan.length} files by ${args.mode}`, true, { moves: plan });
      return `Sorted ${plan.length} files into folders by ${args.mode}` as T;
    }

    // ---- files / organize extras ----
    case "list_smart_folders":
      return s.smartFolders.map((f) => ({ ...f })) as T;
    case "create_smart_folder": {
      const sf: SmartFolder = { id: uid(), name: args.name as string, root: args.root as string, extensions: (args.extensions as string[]) || [], min_age_days: (args.min_age_days as number) ?? null, created_at: Date.now() };
      s.smartFolders.push(sf);
      return { ...sf } as T;
    }
    case "remove_smart_folder": {
      s.smartFolders = s.smartFolders.filter((f) => f.id !== args.id);
      return null as T;
    }
    case "run_smart_folder": {
      // K8 parity: Rust takes `id` (not `dir`) — mirror the real signature
      const id = args.id as string;
      return [
        { path: `C:\\Users\\you\\smart-${id}\\project_notes.md`, size: 4200, modified: Date.now() / 1000 - 3600 },
        { path: `C:\\Users\\you\\smart-${id}\\drafts\\idea.md`, size: 1800, modified: Date.now() / 1000 - 86400 * 3 },
        { path: `C:\\Users\\you\\smart-${id}\\Documents\\todo.md`, size: 950, modified: Date.now() / 1000 - 86400 * 12 },
      ] as T;
    }
    case "plan_archive":
      return [
        { rel: "old_report_2020.pdf", original: `${args.dir}\\old_report_2020.pdf` },
        { rel: "backup_v3.zip", original: `${args.dir}\\backup_v3.zip` },
      ] as T;
    case "apply_archive": {
      const plan = (await call<{ rel: string; original: string }[]>("plan_archive", args));
      pushUndo("archive", `Archived ${plan.length} old files`, true, { zip: `${args.dir}\\_Reforge_Archive.zip`, moves: plan, dir: args.dir });
      s.freedSoFar += 214000000;
      return `Archived ${plan.length} files` as T;
    }
    case "preview_rename":
      return [
        { from: `${args.dir}\\photo1.jpg`, to: `${args.dir}\\${args.prefix}_001.jpg` },
        { from: `${args.dir}\\photo2.jpg`, to: `${args.dir}\\${args.prefix}_002.jpg` },
        { from: `${args.dir}\\photo3.jpg`, to: `${args.dir}\\${args.prefix}_003.jpg` },
      ] as T;
    case "apply_rename": {
      const ops = (await call<{ from: string; to: string }[]>("preview_rename", args));
      pushUndo("rename", `Renamed ${ops.length} files`, true, { ops });
      return `Renamed ${ops.length} files` as T;
    }
    case "organize_screenshots": {
      pushUndo("sort", `Organized 4 screenshots into dated folders`, true, { moves: [] });
      return "Organized 4 screenshots into YYYY/MM folders" as T;
    }
    case "list_stale_downloads":
      return [
        { path: `${args.dir}\\installer_2023.exe`, size: 224000000, modified: Date.now() / 1000 - 86400 * 200, age_days: 200 },
        { path: `${args.dir}\\setup_old.msi`, size: 88000000, modified: Date.now() / 1000 - 86400 * 150, age_days: 150 },
        { path: `${args.dir}\\driver_pack.zip`, size: 310000000, modified: Date.now() / 1000 - 86400 * 95, age_days: 95 },
      ] as T;
    case "delete_stale_downloads": {
      const paths = args.paths as string[];
      pushUndo("downloads_expired", `Sent ${paths.length} stale downloads to Recycle Bin`, false, { paths, freed: 622000000 });
      s.freedSoFar += 622000000;
      return `Sent ${paths.length} files to the Recycle Bin` as T;
    }
    case "flag_stale_apps":
      return [
        { name: "Old Video Editor", exe: "C:\\Program Files\\OldVideo\\oldvideo.exe", last_modified: Date.now() / 1000 - 86400 * 400, age_days: 400 },
        { name: "Trial CAD 2021", exe: "C:\\Program Files\\TrialCAD\\trialcad.exe", last_modified: Date.now() / 1000 - 86400 * 300, age_days: 300 },
      ] as T;
    case "scan_cloud_duplicates":
      return [
        { name: "family_photo_2021.jpg", size: 4200000, paths: ["C:\\Users\\you\\OneDrive\\Pictures\\family_photo_2021.jpg", "C:\\Users\\you\\Dropbox\\Pictures\\family_photo_2021.jpg"] },
        { name: "resume_final.pdf", size: 240000, paths: ["C:\\Users\\you\\OneDrive\\resume_final.pdf", "C:\\Users\\you\\Google Drive\\resume_final.pdf"] },
      ] as T;
    default:
      return undefined;
  }
}
