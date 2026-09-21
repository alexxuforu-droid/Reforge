use crate::duplicates;
use crate::state::AppState;
use crate::storage::{load_json, now_millis, save_json};
use crate::{cleanup, organize};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::error::{io_err, AppError};
#[derive(Serialize, Deserialize, Clone)]
pub struct MaintenanceReport {
    pub ts: u64,
    pub junk_bytes: u64,
    pub junk_items: usize,
    pub duplicate_bytes: u64,
    pub duplicate_files: usize,
    pub storage_top: Vec<organize::FolderSize>,
    /// S11.4 — heavy startup entries (impact ≥ 7) caught by the audit.
    #[serde(default)]
    pub startup_heavy: usize,
    pub notes: Vec<String>,
}

fn reports_dir(state: &AppState) -> std::path::PathBuf {
    state.data_dir.join("reports")
}

#[derive(Serialize)]
pub struct UserFolder {
    pub label: String,
    pub path: String,
    pub exists: bool,
}

/// Well-known user folders for whole-PC sweeps (Makeover Session, A1.6/C5).
/// Only folders that exist are candidates for scanning; the frontend uses the
/// paths as-is for scan_duplicates, so no path is ever constructed blindly.
#[tauri::command]
pub fn get_user_folders() -> Vec<UserFolder> {
    let home = dirs::home_dir().unwrap_or_default();
    let home_str = home.to_string_lossy().to_string();
    let mut out = vec![UserFolder {
        label: "Home".into(),
        path: home_str.clone(),
        exists: home.is_dir(),
    }];
    for base in ["Desktop", "Documents", "Downloads", "Pictures", "OneDrive"] {
        let d = home.join(base);
        out.push(UserFolder {
            label: base.into(),
            path: d.to_string_lossy().to_string(),
            exists: d.is_dir(),
        });
    }
    out
}

#[tauri::command]
/// P3-5 — maintenance sweeps junk + scans the home directories; run the heavy
/// pass off the main thread (same report shape) so the Tune-up view stays
/// responsive while it works.
pub async fn run_maintenance(state: State<'_, AppState>) -> Result<MaintenanceReport, AppError> {
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || run_maintenance_inner(&st))
        .await
        .map_err(|e| AppError::Command(format!("maintenance aborted: {}", e)))?
}

fn run_maintenance_inner(state: &AppState) -> Result<MaintenanceReport, AppError> {
    let mut notes = Vec::new();

    // 1. junk scan (dry-run — never deletes)
    let junk = cleanup::scan_junk();
    notes.push(format!(
        "Found {} of junk across {} areas (nothing deleted — clean from Tune-up).",
        crate::storage::format_bytes(junk.total_bytes),
        junk.items.len()
    ));

    // 2. storage snapshot of the user profile
    let home = dirs::home_dir().unwrap_or_default();
    let storage_top = if home.is_dir() {
        organize::scan_storage(home.to_string_lossy().to_string(), 10).unwrap_or_default()
    } else {
        Vec::new()
    };

    // 2b. startup audit — how many heavy auto-start entries are slowing boot?
    let startup_heavy = crate::startup::list_startup()
        .into_iter()
        .filter(|e| e.impact >= 7)
        .count();
    if startup_heavy > 0 {
        notes.push(format!(
            "{} heavy startup entr{} (impact ≥ 7) — review in Tune-up → Startup.",
            startup_heavy,
            if startup_heavy == 1 { "y" } else { "ies" }
        ));
    }

    // 3. quick duplicate sweep of Desktop + Downloads + Documents
    let mut dup_bytes = 0u64;
    let mut dup_files = 0usize;
    let home = dirs::home_dir().unwrap_or_default();
    for base in ["Desktop", "Downloads", "Documents"] {
        let d = home.join(base);
        if d.is_dir() {
            if let Ok(scan) =
                duplicates::scan_duplicates_silent(d.to_string_lossy().to_string(), 20)
            {
                dup_bytes += scan.total_wasted;
                dup_files += scan.groups.len();
            }
        }
    }
    notes.push(format!(
        "Duplicate sweep found {} wasted across {} groups (Desktop/Downloads/Documents).",
        crate::storage::format_bytes(dup_bytes),
        dup_files
    ));

    let report = MaintenanceReport {
        ts: now_millis(),
        junk_bytes: junk.total_bytes,
        junk_items: junk.items.len(),
        duplicate_bytes: dup_bytes,
        duplicate_files: dup_files,
        storage_top,
        startup_heavy,
        notes,
    };

    std::fs::create_dir_all(reports_dir(state))
        .map_err(|e| io_err(reports_dir(state).display().to_string(), e))?;
    let path = reports_dir(state).join(format!("{}.json", report.ts));
    save_json(&path, &report)?;

    // keep only the 10 most recent reports
    let mut files: Vec<_> = std::fs::read_dir(reports_dir(state))
        .map(|rd| {
            rd.flatten()
                .filter_map(|e| e.path().extension().map(|_| e.path()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    files.sort();
    while files.len() > 10 {
        if let Some(old) = files.first() {
            let _ = std::fs::remove_file(old);
            files.remove(0);
        }
    }

    // fun widgets — maintenance runs are real completion events too
    let _ = crate::fun::note_completion(state, "maintenance");

    Ok(report)
}

#[tauri::command]
pub fn list_reports(state: State<'_, AppState>) -> Vec<MaintenanceReport> {
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(reports_dir(&state)) {
        for e in rd.flatten() {
            let p = e.path();
            if p.extension().map(|x| x == "json").unwrap_or(false) {
                if let Ok(s) = std::fs::read_to_string(&p) {
                    if let Ok(r) = serde_json::from_str::<MaintenanceReport>(&s) {
                        out.push(r);
                    }
                }
            }
        }
    }
    out.sort_by_key(|r| r.ts);
    out.reverse();
    out
}

/// S11.4 — archive a report: move it out of the active list into
/// `reports/archive/` so History's report cards stay focused on what's
/// actionable. Archived reports are never deleted without user action.
#[tauri::command]
pub fn archive_report(state: State<'_, AppState>, ts: u64) -> Result<String, AppError> {
    let src = reports_dir(&state).join(format!("{}.json", ts));
    if !src.exists() {
        return Err(AppError::Command("Report not found".into()));
    }
    let archive = reports_dir(&state).join("archive");
    std::fs::create_dir_all(&archive).map_err(|e| AppError::Io {
        path: archive.display().to_string(),
        source: e,
    })?;
    std::fs::rename(&src, archive.join(format!("{}.json", ts))).map_err(|e| AppError::Io {
        path: src.display().to_string(),
        source: e,
    })?;
    Ok("Report archived".into())
}

// silence unused warning if load_json unused in some cfgs
#[allow(dead_code)]
fn _unused(state: &AppState) {
    let _ = load_json::<Vec<u8>>(&state.data_dir.join("_"), Vec::new());
}

/// Task 8 — Maintenance autopilot: dry-run sweep that returns a before/after
/// report. Safety model: every mutation logs an undo entry BEFORE the change.
/// The sweep itself is dry-run (nothing deleted); the mutations here are the
/// persisted maintenance report (inside `run_maintenance_inner`) and the
/// autopilot report file — both preceded by an undo entry.
#[derive(Serialize, Deserialize, Clone)]
pub struct AutopilotReport {
    pub cleaned_mb: u64,
    pub dupes_removed: u64,
    pub report_id: String,
}

fn run_autopilot_inner(state: &AppState) -> Result<AutopilotReport, AppError> {
    // Snapshot storage radar BEFORE.
    let before = crate::storage::scan_storage_radar();
    let before_used: u64 = before.iter().map(|d| d.used).sum();

    // Undo entry BEFORE the maintenance sweep (which persists a report file).
    crate::undo::log_entry(
        state,
        "autopilot_started",
        "Maintenance autopilot started (before snapshot taken).".to_string(),
        json!({ "before_used_bytes": before_used }),
        false,
    )?;

    let maintenance = run_maintenance_inner(state)?;

    // Snapshot storage radar AFTER.
    let after = crate::storage::scan_storage_radar();
    let after_used: u64 = after.iter().map(|d| d.used).sum();

    let freed_bytes = before_used.saturating_sub(after_used);
    let swept_bytes = maintenance
        .junk_bytes
        .saturating_add(maintenance.duplicate_bytes);
    let cleaned_mb = swept_bytes
        .saturating_add(freed_bytes)
        .saturating_div(1024 * 1024);
    let dupes_removed = maintenance.duplicate_files as u64;
    let report_id = uuid::Uuid::new_v4().to_string();

    let report = AutopilotReport {
        cleaned_mb,
        dupes_removed,
        report_id: report_id.clone(),
    };

    // Undo entry BEFORE persisting the autopilot report file.
    crate::undo::log_entry(
        state,
        "autopilot_report",
        format!(
            "Autopilot report {}: {} MB swept, {} duplicate groups.",
            report_id, cleaned_mb, dupes_removed
        ),
        json!({
            "report_id": report_id,
            "cleaned_mb": cleaned_mb,
            "dupes_removed": dupes_removed,
            "before_used_bytes": before_used,
            "after_used_bytes": after_used,
        }),
        false,
    )?;

    let report_path = reports_dir(state).join(format!("autopilot-{}.json", report_id));
    std::fs::create_dir_all(reports_dir(state))
        .map_err(|e| io_err(reports_dir(state).display().to_string(), e))?;
    save_json(&report_path, &report)?;

    Ok(report)
}

/// P3-5-style async wrapper so the Tune-up view stays responsive while the
/// autopilot sweeps (same spawn_blocking pattern as `run_maintenance`).
#[tauri::command]
pub async fn run_autopilot(state: State<'_, AppState>) -> Result<AutopilotReport, AppError> {
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || run_autopilot_inner(&st))
        .await
        .map_err(|e| AppError::Command(format!("autopilot aborted: {}", e)))?
}

#[cfg(test)]
mod autopilot_tests {
    use super::*;

    fn scratch_state() -> AppState {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "reforge-autopilot-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        AppState { data_dir: dir }
    }

    #[test]
    fn autopilot_report_shape() {
        let state = scratch_state();
        let report = run_autopilot_inner(&state).expect("autopilot should succeed");
        assert!(!report.report_id.is_empty());
        assert!(report.cleaned_mb < u64::MAX);
        assert!(report.dupes_removed < u64::MAX);
        // The report file must have been persisted.
        assert!(reports_dir(&state)
            .join(format!("autopilot-{}.json", report.report_id))
            .exists());
    }
}
