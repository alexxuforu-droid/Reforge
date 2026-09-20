use crate::error::AppError;
use crate::state::AppState;
use crate::storage::{load_json, save_json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{Duration, Instant};

/// D1 — per-app looks: "when app X starts, apply look Y". Rules pair an exe
/// filename with an installed pack id; the watcher matches running processes
/// and applies on transition only (applied-set, so no re-apply until the app
/// exits and relaunches). Observation is read-only: no killing, no injection.

#[derive(Serialize, Deserialize, Clone)]
pub struct AppLookRule {
    pub exe: String,
    pub look_id: String,
}

fn rules_path(state: &AppState) -> std::path::PathBuf {
    state.data_dir.join("app_looks.json")
}

pub fn match_look(running_path: &str, rules: &[AppLookRule]) -> Option<String> {
    let file = running_path
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(running_path);
    rules
        .iter()
        .find(|r| r.exe.eq_ignore_ascii_case(file))
        .map(|r| r.look_id.clone())
}

#[tauri::command]
pub fn list_app_look_rules(state: tauri::State<'_, AppState>) -> Vec<AppLookRule> {
    load_json(&rules_path(&state), Vec::new())
}

#[tauri::command]
pub fn set_app_look_rules(
    state: tauri::State<'_, AppState>,
    rules: Vec<AppLookRule>,
) -> Result<String, AppError> {
    for r in &rules {
        let exe = r.exe.trim();
        if exe.is_empty()
            || exe.chars().count() > 128
            || exe.chars().any(|c| c.is_control() || c == '/' || c == '\\')
        {
            return Err(AppError::Invalid(format!("Invalid exe name: {}", r.exe)));
        }
        if r.look_id.trim().is_empty() {
            return Err(AppError::Invalid("Look id must not be empty.".into()));
        }
    }
    save_json(&rules_path(&state), &rules)?;
    Ok(format!(
        "Saved {} per-app look rule{}.",
        rules.len(),
        if rules.len() == 1 { "" } else { "s" }
    ))
}

/// D1 — minimum gap between two per-app look applies. The poller ticks every
/// 15s; without a cooldown, launching several ruled apps at once would stack
/// applies back-to-back and fight over the theme.
const APPLY_COOLDOWN_SECS: u64 = 30;

/// Pure cooldown gate so tests pin the timing without sleeping.
/// `saturating_duration_since` never panics, even if the clock jumps.
fn cooldown_ready(last_apply: Option<Instant>, now: Instant) -> bool {
    match last_apply {
        None => true,
        Some(t) => now.saturating_duration_since(t) >= Duration::from_secs(APPLY_COOLDOWN_SECS),
    }
}

pub fn spawn_app_look_watcher(app: tauri::AppHandle, state: AppState) {
    std::thread::spawn(move || {
        let mut applied: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut last_apply: Option<Instant> = None;
        let mut sys = sysinfo::System::new_all();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(15));
            let rules: Vec<AppLookRule> = load_json(&rules_path(&state), Vec::new());
            if rules.is_empty() {
                applied.clear();
                continue;
            }
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            let running: std::collections::HashSet<String> = sys
                .processes()
                .values()
                .map(|p| p.name().to_string_lossy().to_string())
                .collect();
            let mut now_running: std::collections::HashSet<String> =
                std::collections::HashSet::new();
            for exe in &running {
                let Some(look) = match_look(exe, &rules) else {
                    continue;
                };
                let key = exe.to_lowercase();
                now_running.insert(key.clone());
                if applied.contains(&key) {
                    continue;
                }
                // Cooldown: skip this tick and retry on the next one — the exe
                // stays out of `applied` so the look is not lost.
                if !cooldown_ready(last_apply, Instant::now()) {
                    continue;
                }
                applied.insert(key);
                let app2 = app.clone();
                let st2 = state.clone();
                match crate::marketplace::apply_bundle_inner(&app2, &st2, &look) {
                    Ok(msg) => {
                        tracing::info!("per-app look applied: {}", msg);
                        last_apply = Some(Instant::now());
                        if let Err(e) = crate::undo::log_entry(
                            &st2,
                            "app_look_applied",
                            format!("Applied look '{look}' for {exe}"),
                            json!({ "exe": exe, "look_id": look }),
                            true,
                        ) {
                            tracing::warn!("per-app look undo log failed: {}", e);
                        }
                    }
                    Err(e) => tracing::warn!("per-app look failed for {}: {}", look, e),
                }
            }
            // forget apps that exited, so the next launch re-applies
            applied.retain(|e| now_running.contains(e));
        }
    });
}

#[cfg(test)]
mod match_tests {
    use super::*;

    #[test]
    fn exe_match_is_case_insensitive_filename_only() {
        let rules = vec![AppLookRule {
            exe: "game.exe".into(),
            look_id: "night".into(),
        }];
        assert_eq!(
            match_look(r"C:\G\GAME.EXE", &rules).as_deref(),
            Some("night")
        );
        assert_eq!(match_look(r"C:\G\other.exe", &rules), None);
    }

    #[test]
    fn per_app_apply_honors_thirty_second_cooldown() {
        let now = std::time::Instant::now();
        assert!(cooldown_ready(None, now));
        assert!(!cooldown_ready(Some(now), now));
        assert!(!cooldown_ready(
            Some(now - std::time::Duration::from_secs(29)),
            now
        ));
        assert!(cooldown_ready(
            Some(now - std::time::Duration::from_secs(30)),
            now
        ));
    }
}
