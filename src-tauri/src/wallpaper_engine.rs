use crate::error::AppError;
use crate::state::AppState;
use crate::undo;
use crate::wallpaper;
use serde_json::json;
use tauri::{Manager, State};

mod render;
mod scenes;
mod state;
mod window;
pub use render::scene_html;
pub use scenes::{builtin_scenes, default_scene, SceneConfig};
use state::{load_custom_scenes, save_custom_scenes};
pub(crate) use state::{load_engine, save_engine};
pub use state::{EngineState, VideoWallpaper};
pub(crate) use window::{
    battery_saver_on, close_window, desktop_background_parent, fullscreen_app_active, open_window,
    rotation_paused, virtual_screen,
};
pub use window::{spawn_monitor, WALLPAPER_WINDOW_LABEL};

#[tauri::command]
pub fn save_custom_scene(
    state: State<'_, AppState>,
    scene: SceneConfig,
) -> Result<Vec<SceneConfig>, AppError> {
    let mut list = load_custom_scenes(&state);
    // same id → update in place; otherwise append
    if let Some(existing) = list.iter_mut().find(|s| s.id == scene.id) {
        *existing = scene.clone();
    } else {
        list.push(scene.clone());
    }
    save_custom_scenes(&state, &list)?;
    undo::log_entry(
        &state,
        "custom_scene_saved",
        format!("Saved custom scene “{}”", scene.name),
        json!({ "scene": scene }),
        false,
    )?;
    Ok(list)
}

#[tauri::command]
pub fn delete_custom_scene(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<SceneConfig>, AppError> {
    let mut list = load_custom_scenes(&state);
    let before = list.len();
    list.retain(|s| s.id != id);
    save_custom_scenes(&state, &list)?;
    if list.len() != before {
        undo::log_entry(
            &state,
            "custom_scene_deleted",
            format!("Deleted custom scene {}", id),
            json!({ "id": id }),
            false,
        )?;
    }
    Ok(list)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_wallpaper_scenes(state: State<'_, AppState>) -> Vec<SceneConfig> {
    let mut all = builtin_scenes();
    all.extend(load_custom_scenes(&state));
    all
}

#[tauri::command]
pub fn get_wallpaper_engine_state(state: State<'_, AppState>) -> EngineState {
    load_engine(&state)
}

#[tauri::command]
pub async fn set_animated_wallpaper(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    scene: SceneConfig,
) -> Result<EngineState, AppError> {
    let before = load_engine(&state);
    // remember the static wallpaper so we can restore it later
    let static_wp = if before.static_wallpaper.is_empty() {
        wallpaper::current_wallpaper()
    } else {
        before.static_wallpaper.clone()
    };
    // E4.7 — switching scene→scene crossfades (2s, reduced-motion aware) by
    // rendering the old scene deterministically on c0 while the new fades in.
    let transition_from = if before.active {
        before.scene.as_ref()
    } else {
        None
    };
    close_window(&app);
    open_window(&app, &scene, transition_from)?;
    let eng = EngineState {
        active: true,
        frozen: false,
        scene: Some(scene.clone()),
        media: None,
        static_wallpaper: static_wp.clone(),
    };
    save_engine(&state, &eng)?;
    undo::log_entry(
        &state,
        "animated_wallpaper",
        format!("Animated wallpaper → {} ({})", scene.name, scene.kind),
        json!({ "scene": scene, "before_active": before.active, "static_wallpaper": static_wp }),
        true,
    )?;
    Ok(eng)
}

#[tauri::command]
pub fn stop_animated_wallpaper(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<EngineState, AppError> {
    let before = load_engine(&state);
    close_window(&app);
    if !before.static_wallpaper.is_empty() {
        let _ = wallpaper::apply_wallpaper_raw(&before.static_wallpaper);
    }
    let eng = EngineState {
        active: false,
        frozen: false,
        scene: None,
        media: None,
        static_wallpaper: String::new(),
    };
    save_engine(&state, &eng)?;
    undo::log_entry(
        &state,
        "animated_wallpaper_stop",
        "Stopped animated wallpaper (static restored)".to_string(),
        json!({ "scene": before.scene }),
        true,
    )?;
    Ok(eng)
}

#[tauri::command]
pub fn freeze_wallpaper(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    frozen: bool,
) -> Result<EngineState, AppError> {
    let mut eng = load_engine(&state);
    eng.frozen = frozen;
    save_engine(&state, &eng)?;
    if let Some(win) = app.get_webview_window(WALLPAPER_WINDOW_LABEL) {
        let _ = win.eval(format!("window.__setPaused({})", frozen));
    }
    Ok(eng)
}

// undo support: stop without logging
pub fn stop_animated(app: &tauri::AppHandle, state: &AppState) -> Result<(), AppError> {
    close_window(app);
    let eng = load_engine(state);
    if !eng.static_wallpaper.is_empty() {
        let _ = wallpaper::apply_wallpaper_raw(&eng.static_wallpaper);
    }
    let cleared = EngineState {
        active: false,
        frozen: false,
        scene: None,
        media: None,
        static_wallpaper: String::new(),
    };
    save_engine(state, &cleared)?;
    Ok(())
}

// undo support: restart a scene without logging
pub fn start_scene(app: &tauri::AppHandle, scene: &SceneConfig) -> Result<(), AppError> {
    close_window(app);
    open_window(app, scene, None)?;
    Ok(())
}
