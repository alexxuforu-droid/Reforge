// Mock store — extracted from lib/mock.ts (V2 pillar 2a, zero behavior change).
// Singleton preview state, persistence, and shared helpers. The dispatcher
// (lib/mock.ts) and the domain handlers (this directory) all share it.
import type {
  AutomationConfig,
  BundleInfo,
  BundleManifest,
  ClipItem,
  DisplayProfile,
  EngineState,
  FontSubstitution,
  LockScreenState,
  MacroRule,
  MaintenanceReport,
  Pack,
  PerfRecord,
  SceneConfig,
  ScreensaverConfig,
  ScreensaverRegistry,
  SmartFolder,
  Snapshot,
  SoundSchemeInfo,
  TaskbarState,
  ThemeState,
  TranscodeConfig,
  UndoEntry,
  VideoWallpaper,
  VpnConnection,
  WallpaperHistoryEntry,
  WallpaperSlideshowConfig,
  WallpaperState,
  WidgetConfig,
  WidgetsSettings,
  AccessibilityState,
  FocusSession,
  GameProfile,
  PowerState,
  UpdateConfig,
  UpdateCheck,
  StagedUpdate,
  BiggestFile,
  BigDupeGroup,
  CleanNowItem,
  StorageConfig,
  UnusedFile,
} from "../types";

// Mock backend (browser preview mode)
// ---------------------------------------------------------------------------

const PACKS: Pack[] = [
  {
    id: "midnight-rain",
    name: "Midnight Rain",
    description: "Deep indigo nights with a calm blue accent. Dark, focused, premium.",
    mode: "dark",
    accent_hex: "#6D7CFF",
    gradient: ["#0B1026", "#2A3B7C"],
    category: "Calm",
  },
  {
    id: "sunset-boulevard",
    name: "Sunset Boulevard",
    description: "Warm oranges melting into dusk. Cozy and energetic.",
    mode: "dark",
    accent_hex: "#FF7B54",
    gradient: ["#1A0E2E", "#E4572E"],
    category: "Energetic",
  },
  {
    id: "nordic-frost",
    name: "Nordic Frost",
    description: "Icy light blues on a crisp, bright desktop. Clean and airy.",
    mode: "light",
    accent_hex: "#2E7CF6",
    gradient: ["#EAF4FF", "#A8C8F0"],
    category: "Minimal",
  },
  {
    id: "forest-calm",
    name: "Forest Calm",
    description: "Mossy greens and deep teals. Easy on the eyes, grounded.",
    mode: "dark",
    accent_hex: "#34D399",
    gradient: ["#071A12", "#14532D"],
    category: "Nature",
  },
  {
    id: "retro-wave",
    name: "Retro Wave",
    description: "Synthwave magenta and cyan, straight from 1986.",
    mode: "dark",
    accent_hex: "#FF2E88",
    gradient: ["#0D0221", "#7B2FF7"],
    category: "Retro",
  },
  {
    id: "minimal-mono",
    name: "Minimal Mono",
    description: "Greyscale restraint. Nothing distracts from your work.",
    mode: "light",
    accent_hex: "#111827",
    gradient: ["#F8FAFC", "#D1D5DB"],
    category: "Minimal",
  },
];

export const SCENES: SceneConfig[] = [
  // A6.1 — new kinds mirror the backend builtins
  { id: "midnight-rain", name: "Midnight Rain", kind: "rain", mood: "calm", speed: 0.8, density: 1.2, colors: ["#60a5fa", "#38bdf8", "#0f172a"] },
  { id: "firefly-grove", name: "Firefly Grove", kind: "fireflies", mood: "nature", speed: 0.5, density: 0.9, colors: ["#fde047", "#a3e635", "#1e293b"] },
  { id: "blizzard-drift", name: "Blizzard Drift", kind: "snowfall-wind", mood: "seasonal", speed: 1.1, density: 1.3, colors: ["#f8fafc", "#e0f2fe", "#1e3a8a"] },
  { id: "bokeh-aurora", name: "Bokeh Bloom", kind: "bokeh", mood: "space", speed: 0.4, density: 0.8, colors: ["#c084fc", "#f472b6", "#38bdf8"] },
  { id: "smoke-ember", name: "Smoke & Ember", kind: "smoke", mood: "energetic", speed: 0.9, density: 0.9, colors: ["#fb923c", "#ef4444", "#facc15"] },
  { id: "ocean-depth", name: "Ocean Depth", kind: "waves-3d", mood: "nature", speed: 0.8, density: 1.0, colors: ["#0ea5e9", "#06b6d4", "#0f172a"] },
  { id: "aurora-drift", name: "Aurora Drift", kind: "aurora", mood: "calm", speed: 0.6, density: 1.0, colors: ["#38bdf8", "#818cf8", "#c084fc"] },
  { id: "deep-tide", name: "Deep Tide", kind: "waves", mood: "calm", speed: 0.7, density: 1.0, colors: ["#0ea5e9", "#1d4ed8", "#0f172a"] },
  { id: "moonlit-dunes", name: "Moonlit Dunes", kind: "particles", mood: "calm", speed: 0.5, density: 0.7, colors: ["#fde68a", "#f8fafc", "#64748b"] },
  { id: "misty-forest", name: "Misty Forest", kind: "parallax", mood: "calm", speed: 0.5, density: 1.0, colors: ["#10b981", "#065f46", "#022c22"] },
  { id: "neon-surge", name: "Neon Surge", kind: "particles", mood: "energetic", speed: 1.6, density: 1.5, colors: ["#f0abfc", "#22d3ee", "#a78bfa"] },
  { id: "synth-grid", name: "Synth Grid", kind: "geometric", mood: "energetic", speed: 1.3, density: 1.2, colors: ["#f472b6", "#818cf8", "#0f172a"] },
  { id: "ember-storm", name: "Ember Storm", kind: "embers", mood: "energetic", speed: 1.4, density: 1.3, colors: ["#fb923c", "#ef4444", "#facc15"] },
  { id: "retro-sunset", name: "Retro Sunset", kind: "geometric", mood: "energetic", speed: 0.9, density: 1.1, colors: ["#ff2e88", "#7b2ff7", "#fbbf24"] },
  { id: "meadow-breeze", name: "Meadow Breeze", kind: "particles", mood: "nature", speed: 0.6, density: 0.8, colors: ["#a3e635", "#84cc16", "#166534"] },
  { id: "coral-reef", name: "Coral Reef", kind: "waves", mood: "nature", speed: 0.8, density: 1.1, colors: ["#2dd4bf", "#f472b6", "#0ea5e9"] },
  { id: "autumn-leaves", name: "Autumn Drift", kind: "parallax", mood: "nature", speed: 0.7, density: 1.2, colors: ["#f59e0b", "#ea580c", "#78350f"] },
  { id: "river-glow", name: "River Glow", kind: "embers", mood: "nature", speed: 0.6, density: 0.9, colors: ["#34d399", "#059669", "#1e293b"] },
  { id: "stardust", name: "Stardust", kind: "stars", mood: "space", speed: 0.5, density: 1.0, colors: ["#e2e8f0", "#818cf8", "#fbbf24"] },
  { id: "nebula-bloom", name: "Nebula Bloom", kind: "aurora", mood: "space", speed: 0.7, density: 1.2, colors: ["#c084fc", "#6366f1", "#f472b6"] },
  { id: "orbital", name: "Orbital", kind: "geometric", mood: "space", speed: 0.8, density: 0.9, colors: ["#38bdf8", "#e2e8f0", "#111827"] },
  { id: "comet-trail", name: "Comet Trail", kind: "stars", mood: "space", speed: 1.0, density: 1.1, colors: ["#f8fafc", "#60a5fa", "#f472b6"] },
  { id: "winter-snow", name: "Winter Snowfall", kind: "particles", mood: "seasonal", speed: 0.7, density: 1.4, colors: ["#f8fafc", "#bae6fd", "#0f172a"] },
  { id: "spring-blossom", name: "Spring Blossom", kind: "parallax", mood: "seasonal", speed: 0.6, density: 1.1, colors: ["#f9a8d4", "#fda4af", "#0f172a"] },
  { id: "holiday-lights", name: "Holiday Lights", kind: "stars", mood: "seasonal", speed: 0.8, density: 1.2, colors: ["#fbbf24", "#34d399", "#ef4444"] },
  { id: "cherry-fall", name: "Cherry Petals", kind: "particles", mood: "seasonal", speed: 0.7, density: 1.0, colors: ["#f9a8d4", "#f472b6", "#1e293b"] },
  // S5 — catalog expansion (26 → 48): mirrors builtin_scenes() in wallpaper_engine.rs.
  { id: "digital-rain", name: "Digital Rain", kind: "matrix", mood: "energetic", speed: 1.2, density: 1.5, colors: ["#22c55e", "#4ade80", "#052e16"] },
  { id: "cipher-fall", name: "Cipher Fall", kind: "matrix", mood: "focused", speed: 0.9, density: 1.3, colors: ["#22d3ee", "#e2e8f0", "#0f172a"] },
  { id: "amber-rain", name: "Amber Rain", kind: "rain", mood: "cozy", speed: 0.7, density: 1.0, colors: ["#f59e0b", "#fbbf24", "#1c1917"] },
  { id: "violet-rain", name: "Violet Rain", kind: "rain", mood: "calm", speed: 0.6, density: 1.1, colors: ["#a78bfa", "#c4b5fd", "#1e1b4b"] },
  { id: "ember-fireflies", name: "Ember Fireflies", kind: "fireflies", mood: "cozy", speed: 0.5, density: 0.9, colors: ["#fb923c", "#fde047", "#1c1917"] },
  { id: "glacier-drift", name: "Glacier Drift", kind: "snowfall-wind", mood: "calm", speed: 0.9, density: 1.2, colors: ["#bae6fd", "#e0f2fe", "#0c4a6e"] },
  { id: "aurora-snow", name: "Aurora Snow", kind: "snowfall-wind", mood: "playful", speed: 0.8, density: 1.1, colors: ["#c4b5fd", "#f8fafc", "#312e81"] },
  { id: "bokeh-city", name: "Bokeh City", kind: "bokeh", mood: "energetic", speed: 0.6, density: 1.1, colors: ["#f472b6", "#22d3ee", "#0f172a"] },
  { id: "incense-smoke", name: "Incense Smoke", kind: "smoke", mood: "calm", speed: 0.4, density: 0.8, colors: ["#d6d3d1", "#fbbf24", "#292524"] },
  { id: "crimson-tide", name: "Crimson Tide", kind: "waves-3d", mood: "energetic", speed: 1.1, density: 1.2, colors: ["#ef4444", "#f97316", "#450a0a"] },
  { id: "aurora-boreal", name: "Aurora Boreal", kind: "aurora", mood: "calm", speed: 0.7, density: 1.1, colors: ["#34d399", "#818cf8", "#0f172a"] },
  { id: "starlight-sea", name: "Starlight Sea", kind: "waves", mood: "calm", speed: 0.6, density: 0.9, colors: ["#1d4ed8", "#60a5fa", "#fbbf24"] },
  { id: "hologram-grid", name: "Hologram Grid", kind: "geometric", mood: "energetic", speed: 1.2, density: 1.1, colors: ["#22d3ee", "#e879f9", "#0f172a"] },
  { id: "pine-snow", name: "Pine Snow", kind: "parallax", mood: "calm", speed: 0.6, density: 1.0, colors: ["#4ade80", "#e2e8f0", "#022c22"] },
  { id: "cloud-veil", name: "Cloud Veil", kind: "parallax", mood: "calm", speed: 0.5, density: 0.9, colors: ["#cbd5e1", "#f8fafc", "#1e293b"] },
  { id: "gold-dust", name: "Gold Dust", kind: "particles", mood: "playful", speed: 0.8, density: 1.0, colors: ["#fbbf24", "#fde68a", "#1c1917"] },
  { id: "cosmic-dust", name: "Cosmic Dust", kind: "particles", mood: "calm", speed: 0.5, density: 0.9, colors: ["#e2e8f0", "#818cf8", "#fbbf24"] },
  { id: "rose-mist", name: "Rose Mist", kind: "particles", mood: "playful", speed: 0.6, density: 0.9, colors: ["#fda4af", "#f9a8d4", "#1e293b"] },
  { id: "ember-wind", name: "Ember Wind", kind: "embers", mood: "energetic", speed: 1.2, density: 1.1, colors: ["#f97316", "#ef4444", "#1c1917"] },
  { id: "forge-glow", name: "Forge Glow", kind: "embers", mood: "cozy", speed: 0.6, density: 0.8, colors: ["#fb923c", "#facc15", "#1c1917"] },
  { id: "shooting-stars", name: "Shooting Stars", kind: "stars", mood: "energetic", speed: 1.1, density: 1.2, colors: ["#f8fafc", "#60a5fa", "#7c3aed"] },
  { id: "polaris", name: "Polaris", kind: "stars", mood: "calm", speed: 0.6, density: 1.0, colors: ["#e2e8f0", "#93c5fd", "#1e1b4b"] },
];

export const store = {
  theme: { accent_hex: "#6D7CFF", mode: "dark", transparency: true, color_prevalence: true } as ThemeState,
  engine: { active: false, frozen: false, scene: null, media: null, static_wallpaper: "" } as EngineState,
  customScenes: [] as SceneConfig[],
  widgets: [] as WidgetConfig[],
  fun: {
    enabled: [] as string[],
    configs: {} as Record<string, Record<string, unknown>>,
    achievements: [] as string[],
    counts: {} as Record<string, number>,
  },
  clips: [] as ClipItem[],
  macros: [] as MacroRule[],
  smartFolders: [] as SmartFolder[],
  displayProfiles: [] as DisplayProfile[],
  automation: {
    weekly_junk: true, monthly_dupes: false, auto_reapply_theme: true, last_weekly_run: 0, last_monthly_run: 0,
    blue_light_on: false, blue_light_intensity: 0.3,
    blue_light_schedule: false, blue_light_start: "19:00", blue_light_end: "07:00",
    style_schedule: [], created_at: 0,
  } as AutomationConfig,
  updateConfig: {
    manifest_url: "https://reforge.app/releases/latest.json",
    check_on_startup: false,
  } as UpdateConfig,
  stagedUpdate: null as StagedUpdate | null,
  /** Test hook: when set, check_for_update returns it instead of the offline error. */
  mockUpdateResult: null as UpdateCheck | null,
  perfHistory: [] as PerfRecord[],
  wallpaper: {
    current: "",
    monitor_supported: true,
    monitors: [{ id: "\\\\.\\DISPLAY1", wallpaper: "" }],
  } as WallpaperState,
  packs: PACKS,
  transcodeConfig: { preset: "balanced" } as TranscodeConfig,
  screensaver: { enabled: false, timeout_secs: 300, scene: null } as ScreensaverConfig,
  screensaverRegistry: { active: false, timeout_secs: 300 } as ScreensaverRegistry,
  screensaverPreviewedAt: 0 as number,
  widgetsSettings: { autohide_fullscreen: true } as WidgetsSettings,
  gameProfiles: [] as GameProfile[],
  appLooks: [] as { exe: string; look_id: string }[],
  power: {
    battery: { percent: 84, on_ac: true, charging: true },
    battery_health: { health_pct: 91, design_mwh: 46800, full_mwh: 42500, cycle_count: 213 },
    plans: [
      { guid: "381b4222-f694-41f0-9685-ff5bb260df2e", name: "Balanced", hint: "Best blend of performance and battery life", active: true },
      { guid: "a1841308-3541-4fab-bc81-f71556f20b4a", name: "Best power efficiency", hint: "Power saver — maximum battery life", active: false },
      { guid: "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c", name: "Best performance", hint: "High performance — maximum speed", active: false },
    ],
    screen_off_ac_min: 10,
    screen_off_dc_min: 5,
    hibernate_enabled: true,
    hibernate_supported: true,
  } as PowerState,
  focusSession: { active: false, ends_at_ts: 0, minutes: 0, dnd_on: false } as FocusSession,
  accessibility: {
    high_contrast: false,
    animations_off: false,
    cursor_size: 32,
    text_scale_pct: 100,
    color_filter: { active: false, filter_type: 0 },
  } as AccessibilityState,
  junk: [
    { id: "temp", label: "User temp files", path: "C:\\Users\\you\\AppData\\Local\\Temp", size: 1_862_000_000, file_count: 4821, admin_required: false },
    { id: "edge_cache", label: "Edge browser cache", path: "C:\\Users\\you\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache", size: 921_000_000, file_count: 1903, admin_required: false },
    { id: "chrome_cache", label: "Chrome browser cache", path: "C:\\Users\\you\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache", size: 1_204_000_000, file_count: 2210, admin_required: false },
    { id: "thumbnail_cache", label: "Explorer thumbnail cache", path: "C:\\Users\\you\\AppData\\Local\\Microsoft\\Windows\\Explorer", size: 412_000_000, file_count: 88, admin_required: false },
    { id: "crash_dumps", label: "Crash dumps", path: "C:\\Users\\you\\AppData\\Local\\CrashDumps", size: 3_120_000_000, file_count: 141, admin_required: false },
    { id: "npm_cache", label: "npm cache", path: "C:\\Users\\you\\AppData\\Local\\npm-cache", size: 508_000_000, file_count: 1220, admin_required: false },
    { id: "windows_temp", label: "Windows temp (admin)", path: "C:\\Windows\\Temp", size: 1_480_000_000, file_count: 630, admin_required: true },
    { id: "update_cache", label: "Windows Update cache (admin)", path: "C:\\Windows\\SoftwareDistribution\\Download", size: 2_240_000_000, file_count: 174, admin_required: true },
  ],
  startup: [
    { name: "Steam", command: "\"C:\\Program Files (x86)\\Steam\\steam.exe\" -silent", location: "HKCU Run", enabled: true, impact: 8, admin_required: false },
    { name: "Discord", command: "\"C:\\Users\\you\\AppData\\Local\\Discord\\app.exe\" --start-minimized", location: "HKCU Run", enabled: true, impact: 7, admin_required: false },
    { name: "Spotify", command: "\"C:\\Users\\you\\AppData\\Local\\Spotify\\Spotify.exe\" --autostart", location: "HKCU Run", enabled: true, impact: 4, admin_required: false },
    { name: "OneDrive", command: "\"C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe\" /background", location: "HKCU Run", enabled: true, impact: 6, admin_required: false },
    { name: "NVIDIA GeForce Experience", command: "\"C:\\Program Files\\NVIDIA Corporation\\NVIDIA GeForce Experience\\NVIDIA GeForce Experience.exe\"", location: "HKLM Run", enabled: true, impact: 9, admin_required: true },
    { name: "Startup Shortcut.lnk", command: "C:\\Users\\you\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Startup Shortcut.lnk", location: "Startup folder", enabled: true, impact: 2, admin_required: false },
  ],
  undo: [] as UndoEntry[],
  snapshots: [] as Snapshot[],
  reports: [] as MaintenanceReport[],
  stagingTrashBytes: 0 as number,
  bundles: [
    {
      id: "studio-blue",
      name: "Studio Blue",
      version: "1.0",
      author: "Reforge Community",
      description: "Calm indigo accent, dark mode, deep-blue gradient wallpaper and a left-aligned small taskbar.",
      component_count: 5,
      applied: false,
    },
    {
      id: "amber-retro",
      name: "Amber Retro",
      version: "2.1",
      author: "PixelPioneer",
      description: "Warm amber on near-black with a geometric animated scene and retro sound scheme.",
      component_count: 4,
      applied: false,
    },
  ] as BundleInfo[],
  manifests: new Map<string, BundleManifest>([
    ["studio-blue", {
      id: "studio-blue",
      name: "Studio Blue",
      version: "1.0",
      author: "Reforge Community",
      description: "Calm indigo accent, dark mode, deep-blue gradient wallpaper and a left-aligned small taskbar.",
      thumbnail: "",
      components: [
        { type: "accent", hex: "#6D7CFF" },
        { type: "theme_mode", mode: "dark" },
        { type: "wallpaper", asset: "wp_studio.png" },
        { type: "taskbar", size: "small", alignment: "left" },
        { type: "cursor", scheme: "aero" },
      ],
    }],
    ["amber-retro", {
      id: "amber-retro",
      name: "Amber Retro",
      version: "2.1",
      author: "PixelPioneer",
      description: "Warm amber on near-black with a geometric animated scene and retro sound scheme.",
      thumbnail: "",
      components: [
        { type: "accent", hex: "#F59E0B" },
        { type: "theme_mode", mode: "dark" },
        { type: "scene", kind: "geometric", speed: 1.3, density: 1.2, colors: ["#f472b6", "#818cf8", "#f59e0b"] },
        { type: "sound_scheme", guid: "{f2e1dd92-4b1a-4f7e-8c5c-5d6b4c3a5d4b}" },
      ],
    }],
  ]),
  vpn: [
    { name: "Work VPN", server_address: "vpn.corp.example.com", status: "disconnected", type: "PPTP" },
    { name: "Home Tunnel", server_address: "home.example.net", status: "disconnected", type: "L2TP/IPsec" },
  ] as VpnConnection[],
  wallpaperHistory: [
    { ts: Date.now() - 86400000 * 2, path: "reforge://wallpapers/midnight-rain.png", monitor_id: null },
    { ts: Date.now() - 86400000 * 5, path: "C:\\Users\\you\\Pictures\\mountain.jpg", monitor_id: null },
  ] as WallpaperHistoryEntry[],
  slideshow: { enabled: false, folder: "", interval_minutes: 10, shuffle: false, next_rotation_ts: null, last_applied: null, favorites: [], day_night_filter: false } as WallpaperSlideshowConfig,
  taskbar: { size: "medium", alignment: "center", autohide: false, color_match: false } as TaskbarState,
  // S5.4 — the real schemes every stock Win10/11 has: `.Default` (Windows
  // Default, sometimes stored under the canonical GUID) and `.None` (No Sounds).
  sounds: [
    { guid: ".Default", name: "Windows Default", current: true, builtin: true },
    { guid: ".None", name: "No Sounds", current: false, builtin: false },
    { guid: "{f2e1dd92-4b1a-4f7e-8c5c-5d6b4c3a5d4b}", name: "Windows Default", current: false, builtin: true },
  ] as SoundSchemeInfo[],
  fonts: [] as FontSubstitution[],
  lockscreen: { mode: "spotlight", image_path: null, slideshow_folder: null, slideshow_interval_secs: null, slideshow_shuffle: null, hide_apps: null } as LockScreenState,
  videoWallpapers: [
    { path: "C:\\Users\\you\\AppData\\Roaming\\com.reforge\\wallpapers\\aurora_loop.mp4", kind: "video", width: 1920, height: 1080, name: "aurora_loop" },
  ] as VideoWallpaper[],
  freedSoFar: 0,
  now: Date.now(),
  onboarding: { wizard_seen: false } as { wizard_seen: boolean },
  favorites: [] as string[],
  // S14 — storage liberation
  storageConfig: {
    unused_days: 180,
    unused_min_mb: 10,
    safe_temp: true,
    safe_update_cache: true,
    safe_recycle_bin: true,
    safe_browser_caches: true,
    safe_installers: true,
    exclusions: [] as string[],
    dry_run: true,
    auto_clean: "off",
  } as StorageConfig,
  recycleBinSize: 2_400_000_000 as number,
  unusedFiles: [] as UnusedFile[],
  // Phase 1 — Security Center preview state (mirrors security_center.rs)
  exclusions: [] as { target: string; kind: string }[],
  scanInProgress: false as boolean,
  rtDisableUntil: 0 as number,
  splash: { enabled: false, timeout_secs: 6, launch_at_login: false } as { enabled: boolean; timeout_secs: number; launch_at_login: boolean },
};

// S5.4 — the canonical "Windows Default" scheme GUID. Mirror of the Rust
// resolver (sounds.rs): machines store Windows Default under either this GUID
// or the plain name `.Default` — treat them as aliases (K7).
const DEFAULT_SCHEME_GUID = "{f2e1dd92-4b1a-4f7e-8c5c-5d6b4c3a5d4b}";

export function resolveSchemeGuid(guid: string): string {
  if (guid.toLowerCase() !== DEFAULT_SCHEME_GUID.toLowerCase()) return guid;
  return store.sounds.some((x) => x.guid === guid) ? guid : ".Default";
}

// ---------------------------------------------------------------------------
// Mock store persistence (B2) — browser preview survives reloads.
// ---------------------------------------------------------------------------

const STORE_KEY = "reforge-mock-v1";

export function persistStore() {
  try {
    const data: Record<string, unknown> = { ...store };
    data.manifests = Array.from(store.manifests.entries());
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable — preview just won't persist */
  }
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(data.manifests)) store.manifests = new Map(data.manifests as [string, BundleManifest][]);
    for (const k of Object.keys(store)) {
      if (k === "manifests") continue;
      if (k in data) (store as Record<string, unknown>)[k] = data[k];
    }
  } catch {
    /* corrupted / version mismatch — start fresh */
  }
}

loadStore();

export const perf = { cpu: 23.4, ramFree: 55.6 };

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function pushUndo(kind: string, description: string, revertible: boolean, data: Record<string, unknown>) {
  store.undo.unshift({ id: uid(), ts: Date.now(), kind, description, revertible, undone: false, data });
}

export function delay(ms = 250): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// S14 — the curated safe-clean list, mirroring cleanup.rs safe_clean_items:
// config toggles pick which categories are eligible; regenerable junk is
// "permanent", old installers are "trash" (staged, undoable).
export const MB = 1024 * 1024;

export function safeCleanItems(): CleanNowItem[] {
  const cfg = store.storageConfig;
  const out: CleanNowItem[] = [];
  for (const j of store.junk) {
    const eligible = (() => {
      switch (j.id) {
        case "temp":
        case "windows_temp":
        case "npm_cache":
        case "crash_dumps":
          return cfg.safe_temp;
        case "update_cache":
          return cfg.safe_update_cache;
        case "edge_cache":
        case "chrome_cache":
        case "thumbnail_cache":
          return cfg.safe_browser_caches;
        default:
          return false;
      }
    })();
    if (!eligible) continue;
    out.push({ ...j, action: "permanent" });
  }
  if (cfg.safe_recycle_bin && store.recycleBinSize > 0) {
    out.push({
      id: "recycle_bin", label: "Recycle Bin", path: "Recycle Bin",
      size: store.recycleBinSize, file_count: 1, action: "permanent", admin_required: false,
    });
  }
  if (cfg.safe_installers) {
    out.push(
      { id: "installer_vlc-3.0.20.exe", label: "vlc-3.0.20.exe", path: "C:\\Users\\you\\Downloads\\vlc-3.0.20.exe", size: 84_000_000, file_count: 1, action: "trash", admin_required: false },
      { id: "installer_obs-30.0.2.exe", label: "obs-30.0.2.exe", path: "C:\\Users\\you\\Downloads\\obs-30.0.2.exe", size: 143_000_000, file_count: 1, action: "trash", admin_required: false },
    );
  }
  return out.sort((a, b) => b.size - a.size);
}

// S14 static scan fixtures (browser preview only — the real commands scan
// the live machine).
export const BIGGEST_FIXTURES: BiggestFile[] = [
  { path: "C:\\Users\\you\\Videos\\edit-final.mp4", size: 3_800_000_000, modified: Date.now() / 1000 - 86400 * 3, category: "Video" },
  { path: "C:\\Users\\you\\Videos\\raw-capture.mkv", size: 2_900_000_000, modified: Date.now() / 1000 - 86400 * 21, category: "Video" },
  { path: "C:\\Users\\you\\Downloads\\linux-6.1.iso", size: 1_850_000_000, modified: Date.now() / 1000 - 86400 * 60, category: "Disk image" },
  { path: "C:\\Users\\you\\Pictures\\hdr-photo-archive.zip", size: 1_120_000_000, modified: Date.now() / 1000 - 86400 * 400, category: "Archive" },
  { path: "C:\\Users\\you\\Downloads\\setup-2024.exe", size: 610_000_000, modified: Date.now() / 1000 - 86400 * 300, category: "Installer" },
  { path: "C:\\Users\\you\\AppData\\Local\\Temp\\big-temp.bin", size: 420_000_000, modified: Date.now() / 1000 - 86400 * 2, category: "Other" },
];

export const UNUSED_FIXTURES: UnusedFile[] = [
  { path: "C:\\Users\\you\\Downloads\\project-backup-2023.zip", size: 960_000_000, modified: Date.now() / 1000 - 86400 * 400, days_old: 400, category: "Archive" },
  { path: "C:\\Users\\you\\Downloads\\old-setup.exe", size: 180_000_000, modified: Date.now() / 1000 - 86400 * 250, days_old: 250, category: "Installer" },
  { path: "C:\\Users\\you\\Documents\\notes-2022.docx", size: 24_000_000, modified: Date.now() / 1000 - 86400 * 500, days_old: 500, category: "Document" },
  { path: "C:\\Users\\you\\Downloads\\recent.pdf", size: 88_000_000, modified: Date.now() / 1000 - 86400 * 10, days_old: 10, category: "Document" },
  { path: "C:\\Users\\you\\Pictures\\old-screen-recording.mp4", size: 1_400_000_000, modified: Date.now() / 1000 - 86400 * 220, days_old: 220, category: "Video" },
];

export const BIG_DUPE_FIXTURES: BigDupeGroup[] = [
  { id: "dupe-videos", wasted_bytes: 2_100_000_000, file_count: 6, sample_paths: ["C:\\Users\\you\\Videos\\clip-1.mp4", "C:\\Users\\you\\Downloads\\clip-1 (copy).mp4"] },
  { id: "dupe-photos", wasted_bytes: 860_000_000, file_count: 41, sample_paths: ["C:\\Users\\you\\Pictures\\IMG_0012.jpg", "C:\\Users\\you\\Pictures\\Exports\\IMG_0012.jpg"] },
  { id: "dupe-docs", wasted_bytes: 210_000_000, file_count: 12, sample_paths: ["C:\\Users\\you\\Documents\\report-final.pdf", "C:\\Users\\you\\Downloads\\report-final (1).pdf"] },
];

export type Store = typeof store;
export type MockCall = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
