use crate::state::AppState;
use crate::storage::format_bytes;
use crate::undo;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use tauri::State;
use walkdir::WalkDir;

use rayon::prelude::*;

use crate::error::AppError;
#[derive(Serialize, Deserialize, Clone)]
pub struct DuplicateGroup {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub files: Vec<DuplicateFile>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DuplicateFile {
    pub path: String,
    pub modified: u64,
}

#[derive(Serialize)]
pub struct DuplicateScan {
    pub groups: Vec<DuplicateGroup>,
    pub total_wasted: u64,
    pub scanned_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MovedFile {
    pub from: String,
    pub to: String,
}

pub(crate) fn trash_dir(state: &AppState) -> PathBuf {
    state.data_dir.join("trash")
}

fn file_hash(path: &Path) -> Option<u64> {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    match std::fs::File::open(path) {
        Ok(mut f) => {
            let mut buf = [0u8; 64 * 1024];
            loop {
                match std::io::Read::read(&mut f, &mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        buf[..n].hash(&mut hasher);
                    }
                    Err(_) => return None,
                }
            }
            Some(hasher.finish())
        }
        Err(_) => None,
    }
}

fn quick_hash(path: &Path) -> Option<u64> {
    // hash of size + first 64KB + last 64KB — cheap pre-filter
    let meta = std::fs::metadata(path).ok()?;
    if !meta.is_file() {
        return None;
    }
    let len = meta.len();
    let mut f = std::fs::File::open(path).ok()?;
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    len.hash(&mut hasher);
    let mut buf = vec![0u8; 65536];
    let n = std::io::Read::read(&mut f, &mut buf).ok()?;
    buf[..n].hash(&mut hasher);
    if len > 131072 {
        use std::io::{Read, Seek, SeekFrom};
        let _ = f.seek(SeekFrom::End(-65536));
        let n = Read::read(&mut f, &mut buf).ok()?;
        buf[..n].hash(&mut hasher);
    }
    Some(hasher.finish())
}

#[tauri::command]
pub async fn scan_duplicates(
    app: tauri::AppHandle,
    dir: String,
    min_size_mb: Option<u64>,
) -> Result<DuplicateScan, AppError> {
    let root = PathBuf::from(&dir);
    if !root.is_dir() {
        return Err(AppError::Command(format!("Not a folder: {}", dir)));
    }
    // count files up front so the progress events carry a real denominator
    let total = WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .count();
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        scan_duplicates_impl(Some(&app), &root, min_size_mb, total)
    })
    .await
    .map_err(|e| AppError::Command(format!("scan aborted: {}", e)))?
}

/// Non-UI sweep (maintenance runs this in the background with no AppHandle,
/// so no progress events — same scan logic, silent).
pub fn scan_duplicates_silent(dir: String, min_size_mb: u64) -> Result<DuplicateScan, AppError> {
    let root = PathBuf::from(&dir);
    if !root.is_dir() {
        return Err(AppError::Command(format!("Not a folder: {}", dir)));
    }
    let total = WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .count();
    scan_duplicates_impl(None, &root, Some(min_size_mb), total)
}

/// The actual scan — runs on a blocking thread so a huge folder never freezes
/// the UI, emitting `scan-progress` { scanned, total, scanned_bytes } events
/// (throttled to ~20/s) that the Organize view renders as a live progress bar.
///
/// Wave 3 perf lane: single sequential walk (directory traversal is
/// metadata-bound and gains nothing from threads), then two rayon-parallel
/// phases — size-prefilter + quick-hash over files, full-hash confirmation
/// per candidate group. The cascade (size → quick → full) and the
/// survivor/dupes semantics are unchanged: `files` holds dupes only, the
/// survivor stays put for `remove_duplicates` staging.
fn scan_duplicates_impl(
    app: Option<&tauri::AppHandle>,
    root: &Path,
    min_size_mb: Option<u64>,
    total: usize,
) -> Result<DuplicateScan, AppError> {
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
    use tauri::Emitter;
    let min_bytes = min_size_mb.unwrap_or(1) * 1024 * 1024;

    // Phase 1 — one sequential walk collecting file paths.
    let paths: Vec<PathBuf> = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.path().to_path_buf())
        .collect();

    // Phase 2 — size-prefilter + quick-hash across the rayon pool.
    let scanned = AtomicUsize::new(0);
    let scanned_bytes = AtomicU64::new(0);
    let last_emit = std::sync::Mutex::new(std::time::Instant::now());
    let quick: Vec<((u64, u64), PathBuf)> = paths
        .par_iter()
        .filter_map(|p| {
            let n = scanned.fetch_add(1, Ordering::Relaxed) + 1;
            let mut hit = None;
            if let Ok(m) = std::fs::metadata(p) {
                let len = m.len();
                if m.is_file() && len >= min_bytes {
                    scanned_bytes.fetch_add(len, Ordering::Relaxed);
                    if let Some(h) = quick_hash(p) {
                        hit = Some(((len, h), p.clone()));
                    }
                }
            }
            if n.is_multiple_of(25) {
                if let Ok(mut guard) = last_emit.try_lock() {
                    if guard.elapsed().as_millis() >= 50 {
                        *guard = std::time::Instant::now();
                        let sb = scanned_bytes.load(Ordering::Relaxed);
                        if let Some(app) = app {
                            let _ = app.emit(
                                "scan-progress",
                                json!({ "scanned": n, "total": total, "scanned_bytes": sb }),
                            );
                        }
                    }
                }
            }
            hit
        })
        .collect();

    let mut by_key: HashMap<(u64, u64), Vec<PathBuf>> = HashMap::new();
    for (k, p) in quick {
        by_key.entry(k).or_default().push(p);
    }
    for v in by_key.values_mut() {
        v.sort();
    }
    if let Some(app) = app {
        let _ = app.emit(
            "scan-progress",
            json!({ "scanned": total, "total": total, "scanned_bytes": scanned_bytes.load(Ordering::Relaxed) }),
        );
    }

    // Phase 3 — full-hash confirmation, one candidate group per thread.
    let candidates: Vec<((u64, u64), Vec<PathBuf>)> =
        by_key.into_iter().filter(|(_, v)| v.len() >= 2).collect();
    let mut groups: Vec<DuplicateGroup> = candidates
        .into_par_iter()
        .filter_map(|(key, paths)| {
            let mut seen: HashMap<u64, PathBuf> = HashMap::new();
            let mut confirmed: Vec<PathBuf> = Vec::new();
            for p in paths {
                if let Some(h) = file_hash(&p) {
                    if seen.contains_key(&h) {
                        confirmed.push(p);
                    } else {
                        seen.insert(h, p);
                    }
                }
            }
            if confirmed.is_empty() {
                return None;
            }
            // group = first file + all confirmed duplicates of it
            let first = seen.into_values().next().unwrap_or_default();
            let mut files: Vec<DuplicateFile> = confirmed
                .into_iter()
                .map(|p| {
                    let modified = std::fs::metadata(&p)
                        .and_then(|m| m.modified())
                        .map(|t| {
                            t.duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_secs())
                                .unwrap_or(0)
                        })
                        .unwrap_or(0);
                    DuplicateFile {
                        path: p.to_string_lossy().to_string(),
                        modified,
                    }
                })
                .collect();
            files.sort_by_key(|f| f.path.clone());
            Some(DuplicateGroup {
                id: format!("dup-{}", key.1),
                name: first
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                size: key.0,
                files,
            })
        })
        .collect();

    let mut total_wasted = 0u64;
    for g in &groups {
        total_wasted += g.size * g.files.len() as u64;
    }

    groups.sort_by_key(|x| std::cmp::Reverse(x.size));
    Ok(DuplicateScan {
        groups,
        total_wasted,
        scanned_bytes: scanned_bytes.load(Ordering::Relaxed),
    })
}

#[tauri::command]
pub fn remove_duplicates(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<String, AppError> {
    let trash = trash_dir(&state);
    std::fs::create_dir_all(&trash).map_err(|e| AppError::Command(e.to_string()))?;
    let mut moved = Vec::new();
    let mut moved_bytes = 0u64;
    for p in &paths {
        let src = PathBuf::from(p);
        if !src.is_file() {
            continue;
        }
        let name = src
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "file".into());
        // avoid collisions in trash
        let mut dst = trash.join(&name);
        let mut i = 1;
        while dst.exists() {
            dst = trash.join(format!("{}_{}", i, name));
            i += 1;
        }
        if let Ok(m) = src.metadata() {
            moved_bytes += m.len();
        }
        match std::fs::rename(&src, &dst) {
            Ok(_) => moved.push(MovedFile {
                from: p.clone(),
                to: dst.to_string_lossy().to_string(),
            }),
            Err(_) => {
                // file may be locked; try copy+delete semantics via remove fallback? just report
                let _ = p;
            }
        }
    }
    undo::log_entry(
        &state,
        "duplicates_removed",
        format!(
            "Moved {} duplicate files ({}) to staging trash",
            moved.len(),
            format_bytes(moved_bytes)
        ),
        json!({ "moved": moved }),
        true,
    )?;
    Ok(format!(
        "Moved {} files to staging trash (reversible)",
        moved.len()
    ))
}

#[tauri::command]
pub fn empty_trash(state: State<'_, AppState>) -> Result<String, AppError> {
    let trash = trash_dir(&state);
    if !trash.exists() {
        return Ok("Trash is empty".into());
    }
    let mut freed = 0u64;
    for entry in WalkDir::new(&trash).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(m) = entry.metadata() {
                freed += m.len();
            }
        }
    }
    std::fs::remove_dir_all(&trash).map_err(|e| AppError::Command(e.to_string()))?;
    std::fs::create_dir_all(&trash).map_err(|e| AppError::Command(e.to_string()))?;
    undo::log_entry(
        &state,
        "trash_emptied",
        format!(
            "Permanently deleted {} of staged duplicates",
            format_bytes(freed)
        ),
        json!({ "freed": freed }),
        false,
    )?;
    Ok(format!(
        "Emptied staging trash — freed {}",
        format_bytes(freed)
    ))
}

#[tauri::command]
pub fn trash_size(state: State<'_, AppState>) -> u64 {
    let trash = trash_dir(&state);
    let mut total = 0u64;
    if trash.exists() {
        for entry in WalkDir::new(&trash).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Ok(m) = entry.metadata() {
                    total += m.len();
                }
            }
        }
    }
    total
}

// undo support: restore moved duplicates
pub fn restore_moved(state: &AppState, moved: &[MovedFile]) -> Result<(), AppError> {
    for m in moved {
        let to = PathBuf::from(&m.to);
        let from = PathBuf::from(&m.from);
        if to.exists() {
            if let Some(parent) = from.parent() {
                std::fs::create_dir_all(parent).map_err(|e| AppError::Command(e.to_string()))?;
            }
            let _ = std::fs::rename(&to, &from);
        }
    }
    let _ = state;
    Ok(())
}

/// D2 — one-click duplicate auto-resolution. The rule picks ONE survivor per
/// group; everything else is a removal candidate for the existing
/// `remove_duplicates` (staging trash, one undo entry). Pure metadata logic:
/// no filesystem access, so untestable states can't arise here.
#[derive(Deserialize, Clone)]
pub enum ResolveRule {
    Newest,
    Oldest,
    InFolder { folder: String },
}

pub fn pick_removals(group: &DuplicateGroup, rule: &ResolveRule) -> Result<Vec<String>, AppError> {
    if group.files.len() < 2 {
        return Ok(vec![]);
    }
    let survivor = match rule {
        ResolveRule::Newest => group.files.iter().max_by_key(|f| f.modified),
        ResolveRule::Oldest => group.files.iter().min_by_key(|f| f.modified),
        ResolveRule::InFolder { folder } => group
            .files
            .iter()
            .find(|f| f.path.starts_with(folder.as_str())),
    }
    .ok_or_else(|| AppError::Invalid("No survivor matched the rule.".into()))?;
    Ok(group
        .files
        .iter()
        .filter(|f| f.path != survivor.path)
        .map(|f| f.path.clone())
        .collect())
}

#[tauri::command]
pub fn resolve_duplicate_group(
    group: DuplicateGroup,
    rule: ResolveRule,
) -> Result<Vec<String>, AppError> {
    pick_removals(&group, &rule)
}

#[cfg(test)]
mod resolve_tests {
    use super::*;

    fn group() -> DuplicateGroup {
        DuplicateGroup {
            id: "g".into(),
            name: "t".into(),
            size: 0,
            files: vec![
                DuplicateFile {
                    path: r"C:\a\old.txt".into(),
                    modified: 1000,
                },
                DuplicateFile {
                    path: r"C:\b\new.txt".into(),
                    modified: 2000,
                },
            ],
        }
    }

    #[test]
    fn keep_newest_removes_all_but_latest() {
        let remove = pick_removals(&group(), &ResolveRule::Newest).unwrap();
        assert_eq!(remove, vec![r"C:\a\old.txt".to_string()]);
    }
}

#[cfg(test)]
mod scan_tests {
    use super::*;
    use std::io::Write;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("reforge-dup-{}-{}", std::process::id(), name));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_file(path: &Path, bytes: &[u8]) {
        let mut f = std::fs::File::create(path).unwrap();
        f.write_all(bytes).unwrap();
    }

    fn scan(dir: &Path) -> DuplicateScan {
        // min_size_mb=0 disables the size prefilter so KB fixtures qualify
        scan_duplicates_impl(None, dir, Some(0), 0).unwrap()
    }

    #[test]
    fn identical_files_group_with_one_survivor() {
        let dir = scratch("group");
        let content = vec![0xABu8; 64 * 1024];
        write_file(&dir.join("a.bin"), &content);
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        write_file(&dir.join("sub").join("b.bin"), &content);
        let r = scan(&dir);
        assert_eq!(r.groups.len(), 1, "identical pair must form one group");
        assert_eq!(
            r.groups[0].files.len(),
            1,
            "group holds dupes only — survivor stays put"
        );
        assert_eq!(r.total_wasted, content.len() as u64);
        assert_eq!(r.scanned_bytes, content.len() as u64 * 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn same_size_different_content_not_grouped() {
        let dir = scratch("distinct");
        write_file(&dir.join("a.bin"), &vec![1u8; 32 * 1024]);
        write_file(&dir.join("b.bin"), &vec![2u8; 32 * 1024]);
        let r = scan(&dir);
        assert!(
            r.groups.is_empty(),
            "full hash must reject quick lookalikes"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn min_size_prefilter_excludes_small_files() {
        let dir = scratch("prefilter");
        let content = vec![7u8; 1024];
        write_file(&dir.join("a.bin"), &content);
        write_file(&dir.join("b.bin"), &content);
        let r = scan_duplicates_impl(None, &dir, Some(1), 0).unwrap();
        assert!(r.groups.is_empty(), "1KB dupes sit below the 1MB floor");
        assert_eq!(r.scanned_bytes, 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn three_copies_yield_two_dupes() {
        let dir = scratch("triple");
        let content = vec![0xCDu8; 16 * 1024];
        for n in ["a.bin", "b.bin", "c.bin"] {
            write_file(&dir.join(n), &content);
        }
        let r = scan(&dir);
        assert_eq!(r.groups.len(), 1);
        assert_eq!(r.groups[0].files.len(), 2);
        assert_eq!(r.total_wasted, content.len() as u64 * 2);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
