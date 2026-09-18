use crate::error::AppError;
use crate::state::AppState;
use crate::storage::{load_json, save_json};
use serde::{Deserialize, Serialize};

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

pub fn spawn_app_look_watcher(app: tauri::AppHandle, state: AppState) {
    std::thread::spawn(move || {
        let mut applied: std::collections::HashSet<String> = std::collections::HashSet::new();
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
                applied.insert(key);
                let app2 = app.clone();
                let st2 = state.clone();
                match crate::marketplace::apply_bundle_inner(&app2, &st2, &look) {
                    Ok(msg) => tracing::info!("per-app look applied: {}", msg),
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
}
