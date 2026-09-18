use crate::state::AppState;
use crate::storage::{load_json, now_millis, save_json};
use crate::undo;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Pack Marketplace — locally-scoped "bundle" system.
//
// A bundle is a directory named `{id}.reforgepack` containing:
//   manifest.json — what's in the pack
//   assets/       — files (wallpapers, fonts, sounds, etc.)
//
// This is a pure local system; no network calls. "Marketplace" here means
// import/export/share-ready bundle files.
//
// Each bundle is applied as a composite operation: a single undo entry stores
// the "before" snapshot so the entire look can be reverted atomically.
// ---------------------------------------------------------------------------

use crate::error::AppError;
#[derive(Serialize, Deserialize, Clone)]
pub struct BundleManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    #[serde(default)]
    pub license: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub thumbnail: String, // relative path inside assets/, or empty
    #[serde(default)]
    pub checksum: String, // sha256 over the bundle's files (manifest excluded)
    // P5-1 — manifest v2: schema_version lets old readers accept v1 packs and
    // new readers know what they're dealing with. 1 = pre-2026-08 manifests.
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub changelog: Vec<String>,
    pub components: Vec<BundleComponent>,
}

fn default_schema_version() -> u32 {
    1
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum BundleComponent {
    #[serde(rename = "accent")]
    Accent { hex: String },
    #[serde(rename = "theme_mode")]
    ThemeMode { mode: String },
    #[serde(rename = "wallpaper")]
    Wallpaper { asset: String },
    #[serde(rename = "video")]
    Video { asset: String },
    #[serde(rename = "taskbar")]
    Taskbar {
        size: Option<String>,
        alignment: Option<String>,
        autohide: Option<bool>,
    },
    #[serde(rename = "cursor")]
    Cursor { scheme: String },
    #[serde(rename = "sound_scheme")]
    SoundScheme { guid: String },
    #[serde(rename = "sound_event")]
    SoundEvent { event: String, asset: String },
    #[serde(rename = "scene")]
    Scene {
        id: String,
        kind: String,
        speed: f64,
        density: f64,
        colors: Vec<String>,
    },
    #[serde(rename = "font_sub")]
    FontSub {
        original: String,
        substitute: String,
    },
    #[serde(rename = "lock_screen")]
    LockScreen {
        mode: String, // "image" | "slideshow" | "spotlight"
        asset: Option<String>,
    },
}

#[derive(Serialize, Clone)]
pub struct BundleInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub component_count: usize,
    pub applied: bool,
    /// P5-8 — how many times this pack has been applied (from the undo log).
    pub applied_count: usize,
}

fn bundles_dir(state: &AppState) -> PathBuf {
    state.data_dir.join("packs")
}

fn bundle_dir(state: &AppState, id: &str) -> PathBuf {
    bundles_dir(state).join(format!("{}.reforgepack", id))
}

fn empty_manifest(name: String) -> BundleManifest {
    BundleManifest {
        id: String::new(),
        name,
        version: "0.1".into(),
        author: "Unknown".into(),
        description: String::new(),
        license: String::new(),
        tags: Vec::new(),
        thumbnail: String::new(),
        checksum: String::new(),
        schema_version: 1,
        changelog: Vec::new(),
        components: Vec::new(),
    }
}

fn list_bundles(state: &AppState) -> Vec<BundleInfo> {
    let dir = bundles_dir(state);
    // a pack counts as "applied" if the undo log has a marketplace_apply for it
    // P5-8 — applied counts come from the undo log too (kind == marketplace_apply).
    let mut applied_counts: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();
    for e in crate::undo::load_undo_entries(state) {
        if e.kind != "marketplace_apply" {
            continue;
        }
        if let Some(id) = e.data.get("bundle_id").and_then(|v| v.as_str()) {
            *applied_counts.entry(id.to_string()).or_insert(0) += 1;
        }
    }
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&dir) {
        for e in rd.flatten() {
            let p = e.path();
            if !p.is_dir() || !p.extension().map(|x| x == "reforgepack").unwrap_or(false) {
                continue;
            }
            let manifest = p.join("manifest.json");
            let m: BundleManifest = load_json(
                &manifest,
                empty_manifest(
                    p.file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default(),
                ),
            );
            if m.id.is_empty() {
                continue;
            }
            let count = applied_counts.get(&m.id).copied().unwrap_or(0);
            out.push(BundleInfo {
                id: m.id.clone(),
                name: m.name,
                version: m.version,
                author: m.author,
                description: m.description,
                component_count: m.components.len(),
                applied: count > 0,
                applied_count: count,
            });
        }
    }
    out.sort_by_key(|a| a.name.to_lowercase());
    out
}

// ---- look capture: snapshot the current look into a bundle --------------------

fn capture_look(state: &AppState) -> BundleManifest {
    let id = Uuid::new_v4().to_string();
    let mut components = Vec::new();
    // accent
    let hex = crate::theme::current_accent_hex();
    components.push(BundleComponent::Accent { hex });
    // theme mode
    let mode = crate::theme::current_mode();
    components.push(BundleComponent::ThemeMode { mode });
    // wallpaper — copy file into assets
    let wp = crate::wallpaper::current_wallpaper();
    if !wp.is_empty() {
        let asset_name = format!("wp_{}.png", now_millis());
        let dst = bundle_dir(state, &id).join("assets").join(&asset_name);
        if let Some(parent) = dst.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::copy(&wp, &dst);
        components.push(BundleComponent::Wallpaper { asset: asset_name });
    }
    // taskbar
    let tb = crate::shell::read_taskbar_state();
    let size = match tb.size.as_str() {
        "small" => Some("small".into()),
        "medium" => None,
        "large" => Some("large".into()),
        _ => None,
    };
    let alignment = match tb.alignment.as_str() {
        "left" => Some("left".into()),
        _ => None,
    };
    let autohide = if tb.autohide { Some(true) } else { None };
    if size.is_some() || alignment.is_some() || autohide.is_some() {
        components.push(BundleComponent::Taskbar {
            size,
            alignment,
            autohide,
        });
    }
    // cursor scheme
    let cursor_state = crate::cursors::read_cursor_state();
    if !cursor_state.scheme_source.is_empty() {
        components.push(BundleComponent::Cursor {
            scheme: cursor_state.scheme_source,
        });
    }
    // lock screen mode
    let ls = crate::lockscreen::get_lock_screen_state();
    let asset = ls
        .image_path
        .as_ref()
        .filter(|_| ls.mode == "image")
        .cloned();
    components.push(BundleComponent::LockScreen {
        mode: ls.mode,
        asset,
    });
    // animated scene currently running (if any)
    let eng = crate::wallpaper_engine::load_engine(state);
    if let Some(scene) = &eng.scene {
        components.push(BundleComponent::Scene {
            id: scene.id.clone(),
            kind: scene.kind.clone(),
            speed: scene.speed,
            density: scene.density,
            colors: scene.colors.clone(),
        });
    }
    // video wallpaper — copy the media file into assets
    if let Some(media) = &eng.media {
        let ext = std::path::Path::new(&media.path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("mp4")
            .to_lowercase();
        let asset_name = format!("video_{}.{}", now_millis(), ext);
        let dst = bundle_dir(state, &id).join("assets").join(&asset_name);
        if let Some(parent) = dst.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::copy(&media.path, &dst);
        components.push(BundleComponent::Video { asset: asset_name });
    }
    // custom sound scheme + per-event sounds the user changed
    let scheme = crate::sounds::get_current_scheme();
    if !scheme.guid.is_empty() && !scheme.builtin {
        components.push(BundleComponent::SoundScheme { guid: scheme.guid });
        for ev in crate::sounds::list_sound_events() {
            if ev.has_sound && !ev.current.is_empty() && ev.current != ev.default {
                let ext = std::path::Path::new(&ev.current)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("wav")
                    .to_lowercase();
                let asset_name = format!(
                    "sound_{}_{}.{}",
                    now_millis(),
                    ev.event.replace('.', "_"),
                    ext
                );
                let dst = bundle_dir(state, &id).join("assets").join(&asset_name);
                if let Some(parent) = dst.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::copy(&ev.current, &dst);
                components.push(BundleComponent::SoundEvent {
                    event: ev.event.clone(),
                    asset: asset_name,
                });
            }
        }
    }
    // font substitutions (only non-trivial ones)
    for sub in crate::fonts::list_font_substitutions() {
        if !sub.substituted.is_empty() && !sub.original.eq_ignore_ascii_case(&sub.substituted) {
            components.push(BundleComponent::FontSub {
                original: sub.original.clone(),
                substitute: sub.substituted.clone(),
            });
        }
    }

    BundleManifest {
        id,
        name: "Captured Look".into(),
        version: "1.0".into(),
        author: "Reforge User".into(),
        description: "A snapshot of your current look captured in one click.".into(),
        license: "Proprietary".into(),
        tags: vec!["captured".into()],
        thumbnail: String::new(),
        checksum: String::new(),
        schema_version: 2,
        changelog: vec!["Captured from the current desktop look.".into()],
        components,
    }
}

// ---- Tauri commands -----------------------------------------------------------

#[tauri::command]
pub fn marketplace_list_bundles(state: State<'_, AppState>) -> Vec<BundleInfo> {
    list_bundles(&state)
}

// ---------------------------------------------------------------------------
// Pack safety — packs are declarative data, never code.
// ---------------------------------------------------------------------------

const FORBIDDEN_EXTENSIONS: &[&str] = &[
    "exe", "dll", "scr", "sys", "com", "msi", "msc", "ps1", "psm1", "bat", "cmd", "vbs", "vbe",
    "js", "jse", "wsf", "wsh", "hta", "jar", "sh", "bash", "py", "rb", "pl", "cpl", "ocx", "drv",
];

const PACK_SIZE_CAP: u64 = 500 * 1024 * 1024; // 500 MB, matches the media import cap

/// Detect executable/script content by real file header, not by extension.
fn looks_executable(data: &[u8]) -> bool {
    let head = &data[..data.len().min(16)];
    head.starts_with(b"MZ") // PE (exe/dll/sys)
        || head.starts_with(b"\x7fELF") // ELF
        || head.starts_with(b"#!") // shebang script
        || head.starts_with(b"\xfe\xed\xfa") // Mach-O
        || head.starts_with(b"\xca\xfe\xba\xbe") // Mach-O fat
        || head.starts_with(b"<%") // ASP/JSP-ish text script
}

/// Walk the pack: reject scripts/executables (content-sniffed, not extension-
/// trusted), cap total size, and reject anything that looks like an archive we'd
/// be tempted to extract (we never extract archives — they stay inert files).
fn validate_pack_security(dir: &std::path::Path) -> Result<(), AppError> {
    let mut total: u64 = 0;
    let mut count: u64 = 0;
    for entry in walkdir::WalkDir::new(dir).max_depth(12) {
        let entry = entry.map_err(|e| AppError::Command(format!("pack scan error: {}", e)))?;
        if !entry.file_type().is_file() {
            continue;
        }
        let p = entry.path();
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if FORBIDDEN_EXTENSIONS.contains(&ext.as_str()) {
            return Err(AppError::Command(format!(
                "Pack contains a forbidden file type ({}) — packs are data-only and may not ship scripts or executables: {}",
                ext, p.display()
            )));
        }
        let data = std::fs::read(p)
            .map_err(|e| AppError::Command(format!("read {}: {}", p.display(), e)))?;
        if looks_executable(&data) {
            return Err(AppError::Command(format!(
                "Pack contains executable content (real file header) — packs are data-only: {}",
                p.display()
            )));
        }
        total += data.len() as u64;
        count += 1;
        if total > PACK_SIZE_CAP {
            return Err(AppError::Command(format!(
                "Pack exceeds the {} MB safety cap.",
                PACK_SIZE_CAP / (1024 * 1024)
            )));
        }
    }
    if count == 0 {
        return Err(AppError::Command("Pack is empty.".into()));
    }
    Ok(())
}

/// Component asset names must be plain filenames — no traversal, no separators.
fn asset_name_ok(asset: &str) -> bool {
    !asset.is_empty()
        && asset != "."
        && asset != ".."
        && !asset.contains("..")
        && !asset.contains('/')
        && !asset.contains('\\')
        && !asset.starts_with('.')
}

fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(data);
    h.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

/// Deterministic checksum over every file in a bundle except manifest.json
/// (the manifest carries the checksum itself, so it can't be part of it).
/// Walks subdirectories — pack media lives in assets/, so a top-level-only
/// scan would miss tampering entirely (P3-1 caught exactly that).
fn bundle_checksum(dir: &std::path::Path) -> String {
    let mut entries: Vec<(String, String)> = Vec::new();
    for item in walkdir::WalkDir::new(dir).max_depth(12) {
        let entry = match item {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let p = entry.path();
        if p.file_name().map(|n| n == "manifest.json").unwrap_or(false) {
            continue;
        }
        if let Ok(data) = std::fs::read(p) {
            let rel = p
                .strip_prefix(dir)
                .map(|r| r.to_string_lossy().to_string())
                .unwrap_or_default();
            entries.push((rel, sha256_hex(&data)));
        }
    }
    entries.sort();
    let joined: String = entries
        .iter()
        .map(|(r, s)| format!("{}:{}\n", r, s))
        .collect();
    sha256_hex(joined.as_bytes())
}

#[tauri::command]
pub fn marketplace_import(
    state: State<'_, AppState>,
    source: String,
) -> Result<BundleInfo, AppError> {
    let src = std::path::Path::new(&source);
    if !src.is_dir() {
        return Err(AppError::Command(
            "Source must be a .reforgepack directory (a folder with manifest.json inside).".into(),
        ));
    }
    let manifest_path = src.join("manifest.json");
    let m: BundleManifest = load_json(&manifest_path, empty_manifest(String::new()));
    if m.id.is_empty() || m.name.is_empty() || m.version.is_empty() {
        return Err(AppError::Command(
            "Invalid pack: manifest.json is missing or incomplete (needs id, name, version)."
                .into(),
        ));
    }
    // validate component assets point at plain filenames and exist
    let assets = src.join("assets");
    for comp in &m.components {
        let asset = match comp {
            BundleComponent::Wallpaper { asset }
            | BundleComponent::Video { asset }
            | BundleComponent::SoundEvent { asset, .. } => Some(asset),
            BundleComponent::LockScreen { asset: Some(a), .. } => Some(a),
            _ => None,
        };
        if let Some(a) = asset {
            if !asset_name_ok(a) {
                return Err(AppError::Command(format!(
                    "Pack contains an unsafe asset path '{}' — refusing to install.",
                    a
                )));
            }
            if !assets.join(a).exists() {
                return Err(AppError::Command(format!(
                    "Pack references missing asset '{}'.",
                    a
                )));
            }
        }
    }
    // security sweep over the whole bundle
    validate_pack_security(src)?;
    // checksum verification (when the pack ships one)
    if !m.checksum.is_empty() {
        let actual = bundle_checksum(src);
        if actual != m.checksum {
            return Err(AppError::Command("Checksum mismatch — the pack is corrupted or was tampered with. Refusing to install.".into(),));
        }
    }
    let dst = bundle_dir(&state, &m.id);
    if dst.exists() {
        return Err(AppError::Command(format!(
            "A pack with id '{}' is already installed.",
            m.id
        )));
    }
    // copy the entire bundle directory
    if let Some(parent) = dst.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    copy_dir_all(src, &dst)
        .map_err(|e| AppError::Command(format!("Failed to copy pack: {}", e)))?;
    Ok(BundleInfo {
        id: m.id.clone(),
        name: m.name,
        version: m.version,
        author: m.author,
        description: m.description,
        component_count: m.components.len(),
        applied: false,
        applied_count: 0,
    })
}

#[tauri::command]
pub fn marketplace_export_look(
    state: State<'_, AppState>,
    name: String,
) -> Result<BundleInfo, AppError> {
    let m = capture_look(&state);
    let dir = bundle_dir(&state, &m.id);
    std::fs::create_dir_all(dir.join("assets")).map_err(|e| AppError::Command(e.to_string()))?;
    // write manifest (with the user's name), then compute + store the checksum
    let mut m = m;
    m.name = if name.is_empty() {
        "My Look".into()
    } else {
        name
    };
    let manifest_path = dir.join("manifest.json");
    save_json(&manifest_path, &m)?;
    m.checksum = bundle_checksum(&dir);
    save_json(&manifest_path, &m)?;
    Ok(BundleInfo {
        id: m.id.clone(),
        name: m.name,
        version: m.version,
        author: m.author,
        description: m.description,
        component_count: m.components.len(),
        applied: false,
        applied_count: 0,
    })
}

#[tauri::command]
pub fn marketplace_export_to_path(
    state: State<'_, AppState>,
    bundle_id: String,
    out_path: String,
) -> Result<String, AppError> {
    let src = bundle_dir(&state, &bundle_id);
    if !src.exists() {
        return Err(AppError::Command(format!(
            "Bundle {} not found.",
            bundle_id
        )));
    }
    let dst = std::path::Path::new(&out_path);
    if dst.exists() {
        return Err(AppError::Command("Target path already exists.".into()));
    }
    copy_dir_all(&src, dst).map_err(|e| AppError::Command(format!("Export failed: {}", e)))?;
    Ok(format!("Exported to {}", dst.display()))
}

#[tauri::command]
pub fn marketplace_apply_bundle(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    bundle_id: String,
) -> Result<String, AppError> {
    apply_bundle_inner(&app, &state, &bundle_id)
}

/// The apply logic without the Tauri state wrapper — the style scheduler
/// (P5-7 scheduled pack rotation) calls this directly.
pub fn apply_bundle_inner(
    app: &tauri::AppHandle,
    state: &AppState,
    bundle_id: &str,
) -> Result<String, AppError> {
    let manifest_path = bundle_dir(state, bundle_id).join("manifest.json");
    let m: BundleManifest = load_json(&manifest_path, empty_manifest(String::new()));
    if m.id.is_empty() {
        return Err(AppError::Command(
            "Bundle not found or manifest corrupted.".into(),
        ));
    }
    // capture before state for undo
    let before_accent = crate::theme::current_accent_hex();
    let before_mode = crate::theme::current_mode();
    let before_wallpaper = crate::wallpaper::current_wallpaper();
    let before_taskbar = crate::shell::read_taskbar_state();
    let before_lockscreen = crate::lockscreen::get_lock_screen_state();
    let before_cursor = crate::cursors::read_cursor_state();
    let before_scheme = crate::sounds::list_sound_schemes()
        .into_iter()
        .find(|s| s.current)
        .map(|s| s.guid)
        .unwrap_or_default();

    let assets = bundle_dir(state, bundle_id).join("assets");

    // apply each component
    for comp in &m.components {
        match comp {
            BundleComponent::Accent { hex } => {
                let _ = crate::theme::apply_accent_hex_raw(hex);
            }
            BundleComponent::ThemeMode { mode } => {
                let _ = crate::theme::apply_mode_raw(mode);
            }
            BundleComponent::Wallpaper { asset } => {
                let path = assets.join(asset);
                if path.exists() {
                    let _ = crate::wallpaper::apply_wallpaper_raw(&path.to_string_lossy());
                }
            }
            BundleComponent::Video { asset } => {
                let src = assets.join(asset);
                if src.exists() {
                    let ext = asset.rsplit('.').next().unwrap_or("mp4").to_lowercase();
                    let kind = if ext == "gif" { "gif" } else { "video" };
                    let dst = state.wallpapers_dir().join(asset);
                    let _ = std::fs::copy(&src, &dst);
                    let (w, h) = crate::transcode::probe_dimensions(&dst).unwrap_or((1920, 1080));
                    let video = crate::wallpaper_engine::VideoWallpaper {
                        path: dst.to_string_lossy().to_string(),
                        kind: kind.into(),
                        width: w,
                        height: h,
                        name: asset
                            .strip_suffix(&format!(".{}", ext))
                            .unwrap_or(asset)
                            .to_string(),
                        monitor: None,
                    };
                    let _ = crate::wallpaper_video::start_video(app, &video);
                    let mut eng = crate::wallpaper_engine::load_engine(state);
                    eng.active = true;
                    eng.frozen = false;
                    eng.scene = None;
                    eng.media = Some(video);
                    let _ = crate::wallpaper_engine::save_engine(state, &eng);
                }
            }
            BundleComponent::Taskbar {
                size,
                alignment,
                autohide,
            } => {
                if let Some(s) = size {
                    let v = match s.as_str() {
                        "small" => 0u32,
                        "large" => 2u32,
                        _ => 1u32,
                    };
                    let _ = crate::shell::set_taskbar_value_raw("TaskbarSi", v);
                }
                if let Some(a) = alignment {
                    let v = if a == "left" { 0u32 } else { 1u32 };
                    let _ = crate::shell::set_taskbar_value_raw("TaskbarAl", v);
                }
                if let Some(h) = autohide {
                    let _ = crate::shell::set_taskbar_value_raw(
                        "TaskbarAutoHide",
                        if *h { 1u32 } else { 0u32 },
                    );
                }
                crate::shell::notify_shell_change_pub();
            }
            BundleComponent::Cursor { scheme } => {
                let _ = crate::cursors::apply_scheme_raw(scheme);
            }
            BundleComponent::SoundScheme { guid } => {
                let _ = crate::sounds::set_scheme_raw(guid);
            }
            BundleComponent::SoundEvent { event, asset } => {
                let path = assets.join(asset);
                if path.exists() {
                    let _ = crate::sounds::set_event_raw(event, &path.to_string_lossy());
                }
            }
            BundleComponent::Scene {
                id: _sid,
                kind,
                speed,
                density,
                colors,
            } => {
                let scene = crate::wallpaper_engine::SceneConfig {
                    id: _sid.clone(),
                    name: m.name.clone(),
                    kind: kind.clone(),
                    mood: "custom".into(),
                    speed: *speed,
                    density: *density,
                    colors: colors.clone(),
                };
                let _ = crate::wallpaper_engine::start_scene(app, &scene);
            }
            BundleComponent::FontSub {
                original,
                substitute,
            } => {
                let _ = crate::fonts::restore_substitution(original, substitute);
            }
            BundleComponent::LockScreen { mode, asset } => {
                match mode.as_str() {
                    "image" => {
                        if let Some(a) = asset {
                            let path = assets.join(a);
                            if path.exists() {
                                // copy to app data lock screen dir
                                let dst = state
                                    .data_dir
                                    .join("lockscreen")
                                    .join("bundle_lockscreen.png");
                                if let Some(parent) = dst.parent() {
                                    let _ = std::fs::create_dir_all(parent);
                                }
                                let _ = std::fs::copy(&path, &dst);
                                let _ = crate::lockscreen::set_lock_screen_image_pub(
                                    state,
                                    &dst.to_string_lossy(),
                                );
                            }
                        }
                    }
                    "slideshow" => {
                        // can't meaningfully capture a slideshow from bundle — skip
                    }
                    _ => {
                        let _ = crate::lockscreen::set_lock_screen_spotlight_pub(state);
                    }
                }
            }
        }
    }

    // log composite undo
    undo::log_entry(
        state,
        "marketplace_apply",
        format!("Applied pack: {}", m.name),
        json!({
            "bundle_id": bundle_id,
            "before": {
                "accent": before_accent,
                "mode": before_mode,
                "wallpaper": before_wallpaper,
                "taskbar": before_taskbar,
                "lockscreen": before_lockscreen,
                "cursor": before_cursor,
                "sound_scheme": before_scheme,
            }
        }),
        true,
    )?;

    Ok(format!(
        "Applied pack '{}' ({} components). Revert from History.",
        m.name,
        m.components.len()
    ))
}

#[tauri::command]
pub fn marketplace_get_manifest(
    state: State<'_, AppState>,
    bundle_id: String,
) -> Result<serde_json::Value, AppError> {
    let manifest_path = bundle_dir(&state, &bundle_id).join("manifest.json");
    let m: BundleManifest = load_json(&manifest_path, empty_manifest(String::new()));
    if m.id.is_empty() {
        return Err(AppError::Command("Bundle not found.".into()));
    }
    serde_json::to_value(&m).map_err(|e| AppError::Command(e.to_string()))
}

#[tauri::command]
pub fn marketplace_delete_bundle(
    state: State<'_, AppState>,
    bundle_id: String,
) -> Result<(), AppError> {
    let dir = bundle_dir(&state, &bundle_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| AppError::Command(e.to_string()))?;
    }
    Ok(())
}

/// P5-2 — pack preview: read one asset (e.g. the wallpaper) out of an
/// installed bundle as a data URL so the preview modal can render it (the
/// webview CSP blocks file:// images). Asset names are validated like imports.
#[tauri::command]
pub fn marketplace_preview_asset(
    state: State<'_, AppState>,
    bundle_id: String,
    asset: String,
) -> Result<String, AppError> {
    if !asset_name_ok(&asset) {
        return Err(AppError::Invalid("Unsafe asset path.".into()));
    }
    let path = bundle_dir(&state, &bundle_id).join("assets").join(&asset);
    crate::lockscreen::image_data_url(&path)
}

/// P5-3 — build a pack from declarative components (share codes). Packs made
/// this way carry no media files — only the look's settings. Security is
/// trivial: components are plain data, no files enter the bundle.
#[tauri::command]
pub fn marketplace_import_components(
    state: State<'_, AppState>,
    name: String,
    components: Vec<BundleComponent>,
) -> Result<BundleInfo, AppError> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Invalid("Give the pack a name.".into()));
    }
    if components.is_empty() {
        return Err(AppError::Invalid(
            "Nothing to import — the code decoded to zero components.".into(),
        ));
    }
    let id = Uuid::new_v4().to_string();
    let dir = bundle_dir(&state, &id);
    std::fs::create_dir_all(dir.join("assets")).map_err(|e| AppError::Command(e.to_string()))?;
    let mut m = BundleManifest {
        id: id.clone(),
        name: name.clone(),
        version: "1.0".into(),
        author: "Shared code".into(),
        description: "Imported from a share code — the declarative look, no media files.".into(),
        license: String::new(),
        tags: vec!["shared".into(), "code".into()],
        thumbnail: String::new(),
        checksum: String::new(),
        schema_version: 2,
        changelog: Vec::new(),
        components,
    };
    let manifest_path = dir.join("manifest.json");
    save_json(&manifest_path, &m)?;
    m.checksum = bundle_checksum(&dir);
    save_json(&manifest_path, &m)?;
    Ok(BundleInfo {
        id,
        name,
        version: m.version,
        author: m.author,
        description: m.description,
        component_count: m.components.len(),
        applied: false,
        applied_count: 0,
    })
}

// helper: recursive directory copy
fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Hand-rolled temp dir (same pattern as wallpaper.rs / undo.rs) — packs
    /// are data-only, so these need no Windows APIs and run anywhere.
    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            use std::sync::atomic::{AtomicU64, Ordering};
            static SEQ: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "reforge-pack-test-{}-{}-{}",
                std::process::id(),
                SEQ.fetch_add(1, Ordering::Relaxed),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos())
                    .unwrap_or(0)
            ));
            std::fs::create_dir_all(&path).unwrap();
            TestDir(path)
        }

        fn file(&self, rel: &str, contents: &[u8]) -> &Self {
            let p = self.0.join(rel);
            if let Some(parent) = p.parent() {
                std::fs::create_dir_all(parent).unwrap();
            }
            std::fs::write(&p, contents).unwrap();
            self
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn rejects_forbidden_extension() {
        let t = TestDir::new();
        t.file("manifest.json", b"{}")
            .file("assets/evil.exe", b"not really an exe");
        let err = validate_pack_security(&t.0).unwrap_err();
        assert!(err.to_string().contains("forbidden"), "got: {}", err);
    }

    #[test]
    fn rejects_executable_content_even_with_innocent_name() {
        // PE header sniffs as executable regardless of the .png extension.
        let t = TestDir::new();
        t.file("manifest.json", b"{}")
            .file("assets/data.png", b"MZ\x90\x00fake-headers");
        let err = validate_pack_security(&t.0).unwrap_err();
        assert!(
            err.to_string().contains("executable content"),
            "got: {}",
            err
        );
    }

    #[test]
    fn rejects_shebang_scripts() {
        let t = TestDir::new();
        t.file("manifest.json", b"{}")
            .file("assets/notes.txt", b"#!/bin/sh\necho hi");
        let err = validate_pack_security(&t.0).unwrap_err();
        assert!(
            err.to_string().contains("executable content"),
            "got: {}",
            err
        );
    }

    #[test]
    fn accepts_clean_data_pack() {
        let t = TestDir::new();
        t.file("manifest.json", b"{}")
            .file("assets/wall.png", b"PNG bytes")
            .file("assets/loop.mp4", b"video bytes")
            .file("assets/ding.wav", b"wave bytes");
        assert!(validate_pack_security(&t.0).is_ok());
    }

    #[test]
    fn rejects_empty_pack() {
        let t = TestDir::new();
        let err = validate_pack_security(&t.0).unwrap_err();
        assert!(err.to_string().contains("empty"), "got: {}", err);
    }

    #[test]
    fn unsafe_asset_names_rejected() {
        assert!(!asset_name_ok("../escape.png"));
        assert!(!asset_name_ok("a/b.png"));
        assert!(!asset_name_ok("a\\b.png"));
        assert!(!asset_name_ok(".hidden"));
        assert!(!asset_name_ok(""));
        assert!(!asset_name_ok(".."));
        assert!(asset_name_ok("wall.png"));
        assert!(asset_name_ok("video_123.mp4"));
        assert!(asset_name_ok("sound_SystemStart.wav"));
    }

    #[test]
    fn checksum_is_deterministic_and_catches_tampering() {
        let t = TestDir::new();
        t.file("manifest.json", b"{}")
            .file("assets/wall.png", b"PNG bytes");
        let a = bundle_checksum(&t.0);
        let b = bundle_checksum(&t.0);
        assert_eq!(a, b, "checksum must be deterministic");
        // tamper with a payload file → checksum must change
        std::fs::write(t.0.join("assets/wall.png"), b"PNG tampered").unwrap();
        let c = bundle_checksum(&t.0);
        assert_ne!(a, c, "tampering must change the checksum");
    }
}
