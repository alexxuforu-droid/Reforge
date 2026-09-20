use crate::error::AppError;
use crate::state::AppState;
use crate::storage::load_json;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct DashboardMetrics {
    pub personalization_score: u32,
    pub storage_freed: u64,
    pub files_organized: u64,
    pub time_saved_secs: u64,
    pub active_features: Vec<String>,
}

#[tauri::command]
pub fn get_dashboard_metrics(state: State<'_, AppState>) -> DashboardMetrics {
    metrics_inner(&state)
}

/// v1.1 Task 2 — shared inner so get_dashboard_summary reuses the exact same
/// personalization/storage math (single source of truth, zero behavior change).
pub fn metrics_inner(state: &AppState) -> DashboardMetrics {
    let entries = crate::undo::load_undo_entries(&state);
    let mut storage_freed = 0u64;
    let mut files_organized = 0u64;
    let mut active: Vec<String> = Vec::new();

    for e in &entries {
        match e.kind.as_str() {
            "junk_clean" | "trash_emptied" => {
                if let Some(f) = e.data.get("freed").and_then(|v| v.as_u64()) {
                    storage_freed += f;
                }
            }
            "downloads_expired" => {
                if let Some(f) = e.data.get("freed").and_then(|v| v.as_u64()) {
                    storage_freed += f;
                }
            }
            "archive" => {
                if let Some(m) = e.data.get("moves").and_then(|v| v.as_array()) {
                    files_organized += m.len() as u64;
                }
            }
            "sort" => {
                if let Some(m) = e.data.get("moves").and_then(|v| v.as_array()) {
                    files_organized += m.len() as u64;
                }
            }
            "rename" => {
                if let Some(o) = e.data.get("ops").and_then(|v| v.as_array()) {
                    files_organized += o.len() as u64;
                }
            }
            _ => {}
        }
    }

    // personalization: count active makeover features
    let eng: crate::wallpaper_engine::EngineState = load_json(
        &state.data_dir.join("wallpaper_engine.json"),
        crate::wallpaper_engine::EngineState::default(),
    );
    if eng.active {
        active.push("Animated wallpaper".into());
    }
    let theme: serde_json::Value = load_json(
        &state.data_dir.join("theme_state.json"),
        serde_json::json!({}),
    );
    let accent = theme
        .get("accent_hex")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if !accent.is_empty() && accent.to_lowercase() != "#6d7cff" {
        active.push(format!("Custom accent {}", accent));
    }
    let widgets: Vec<serde_json::Value> =
        load_json(&state.data_dir.join("widgets.json"), Vec::new());
    if !widgets.is_empty() {
        active.push(format!("{} desktop widget(s)", widgets.len()));
    }
    let automation: crate::automation::AutomationConfig = load_json(
        &state.data_dir.join("automation.json"),
        crate::automation::AutomationConfig::default(),
    );
    if automation.blue_light_on {
        active.push("Blue light filter".into());
    }
    if automation.weekly_junk {
        active.push("Scheduled maintenance".into());
    }
    let macros: Vec<serde_json::Value> = load_json(&state.data_dir.join("macros.json"), Vec::new());
    if !macros.is_empty() {
        active.push(format!("{} automation macro(s)", macros.len()));
    }
    // Cursors live in the registry (HKCU Control Panel\Cursors), not in a
    // cursors.json file — read the real state so "Custom cursor scheme"
    // actually shows up after a scheme is applied.
    if !crate::cursors::read_cursor_state().scheme_source.is_empty() {
        active.push("Custom cursor scheme".into());
    }

    let base = 30u32;
    let feats = (active.len() as u32) * 10;
    let personalization_score = (base + feats).min(100);

    let time_saved_secs = files_organized * 4 + storage_freed / (1024 * 1024) * 3;

    DashboardMetrics {
        personalization_score,
        storage_freed,
        files_organized,
        time_saved_secs,
        active_features: active,
    }
}

// ---- IPC hot-path diet (v1.1 Task 2) ----
//
// One composite for boot/hot paths: the real health score + personalization +
// storage in MB + undo count, with none of the heavy lists (active_features
// strings, full undo log). Field names stay snake_case like every other
// command; the TS mirror in src/lib/types.ts matches exactly.

#[derive(Serialize)]
pub struct DashboardSummary {
    pub health: u32,
    pub personalization: u32,
    pub storage_freed_mb: u64,
    pub undo_total: usize,
}

#[tauri::command]
pub fn get_dashboard_summary(state: State<'_, AppState>) -> Result<DashboardSummary, AppError> {
    Ok(summary_inner(&state))
}

/// v1.1 Task 2 — pure inner built on `metrics_inner` +
/// `health_score_inner` + `load_undo_entries()` so the command stays a thin
/// wrapper and unit tests don't need a Tauri `State`.
pub fn summary_inner(state: &AppState) -> DashboardSummary {
    let metrics = metrics_inner(state);
    let health = crate::system::health_score_inner(state);
    DashboardSummary {
        health: health.score as u32,
        personalization: metrics.personalization_score,
        storage_freed_mb: metrics.storage_freed / 1_048_576,
        undo_total: crate::undo::load_undo_entries(state).len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDir(std::path::PathBuf);

    impl TestDir {
        fn new() -> Self {
            use std::sync::atomic::{AtomicU64, Ordering};
            static SEQ: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "reforge-dashboard-test-{}-{}-{}",
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

        fn state(&self) -> AppState {
            AppState {
                data_dir: self.0.clone(),
            }
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// v1.1 Task 2 gate: summary composes health + personalization + storage
    /// (MB, u64) + undo count without the heavy lists.
    #[test]
    fn summary_smoke() {
        let t = TestDir::new();
        let summary = super::summary_inner(&t.state());
        assert!(summary.health <= 100);
        assert!(summary.personalization <= 100);
        assert_eq!(summary.undo_total, 0);
        assert_eq!(summary.storage_freed_mb, 0);
        // serializes with the exact snake_case field names
        let v = serde_json::to_value(&summary).unwrap();
        assert!(v.get("health").is_some());
        assert!(v.get("personalization").is_some());
        assert!(v.get("storage_freed_mb").is_some());
        assert!(v.get("undo_total").is_some());
    }
}
