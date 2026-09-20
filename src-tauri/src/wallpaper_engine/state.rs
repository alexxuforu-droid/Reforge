// state — extracted from wallpaper_engine.rs (V2 pillar 2, zero behavior change).
use super::scenes::SceneConfig;
use crate::error::AppError;
use crate::state::AppState;
use crate::storage::{load_json, save_json};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

fn engine_path(state: &AppState) -> PathBuf {
    state.data_dir.join("wallpaper_engine.json")
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct EngineState {
    pub active: bool,
    pub frozen: bool,
    pub scene: Option<SceneConfig>,
    pub media: Option<VideoWallpaper>,
    pub static_wallpaper: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VideoWallpaper {
    pub path: String,
    pub kind: String, // "video" | "gif"
    pub width: u32,
    pub height: u32,
    pub name: String,
    /// Monitor this video is pinned to (Windows device name, e.g.
    /// "\\.\DISPLAY2" — matches tauri's Monitor::name and get_display_info
    /// ids). None = span every monitor with one window over the virtual
    /// screen. Serde-defaulted so pre-M1 engine files/undo payloads load.
    #[serde(default)]
    pub monitor: Option<String>,
}

pub(crate) fn load_engine(state: &AppState) -> EngineState {
    load_json(&engine_path(state), EngineState::default())
}

pub(crate) fn save_engine(state: &AppState, e: &EngineState) -> Result<(), AppError> {
    save_json(&engine_path(state), e)
}

// ---------------------------------------------------------------------------
// Custom scenes (A6.2 — scene editor v2 persistence)
// ---------------------------------------------------------------------------

fn custom_scenes_path(state: &AppState) -> PathBuf {
    state.data_dir.join("custom_scenes.json")
}

pub(crate) fn load_custom_scenes(state: &AppState) -> Vec<SceneConfig> {
    load_json(&custom_scenes_path(state), Vec::new())
}

pub(crate) fn save_custom_scenes(state: &AppState, scenes: &[SceneConfig]) -> Result<(), AppError> {
    save_json(&custom_scenes_path(state), &scenes)
}

#[cfg(test)]
mod s4_tests {
    use super::super::scenes::default_scene;
    use super::*;

    /// Hand-rolled temp dir (same pattern as wallpaper.rs) so these need no dev-dependency.
    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "reforge-engine-test-{}-{}",
                std::process::id(),
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

    fn json(e: &EngineState) -> serde_json::Value {
        serde_json::to_value(e).unwrap()
    }

    /// S4.4 — apply_style writes exactly these EngineState shapes for the three
    /// wallpaper types (see styles.rs); prove each survives a save/load
    /// round-trip unchanged, so restore_on_startup brings back what was applied.
    #[test]
    fn engine_roundtrip_scene_shape() {
        let t = TestDir::new();
        let e = EngineState {
            active: true,
            frozen: false,
            scene: Some(default_scene()),
            media: None,
            static_wallpaper: "C:\\Users\\you\\Pictures\\fallback.jpg".into(),
        };
        save_engine(&t.state(), &e).unwrap();
        assert_eq!(json(&load_engine(&t.state())), json(&e));
    }

    #[test]
    fn engine_roundtrip_live_media_shape() {
        let t = TestDir::new();
        let e = EngineState {
            active: true,
            frozen: false,
            scene: None,
            media: Some(VideoWallpaper {
                path: "C:\\videos\\aurora.mp4".into(),
                kind: "video".into(),
                width: 1920,
                height: 1080,
                name: "aurora_loop".into(),
                monitor: Some("\\\\.\\DISPLAY2".into()),
            }),
            static_wallpaper: "C:\\Users\\you\\Pictures\\fallback.jpg".into(),
        };
        save_engine(&t.state(), &e).unwrap();
        assert_eq!(json(&load_engine(&t.state())), json(&e));
    }

    #[test]
    fn engine_roundtrip_static_default_shape() {
        // The static path writes EngineState::default() (styles.rs) — a frozen
        // engine with the previous static wallpaper retained.
        let t = TestDir::new();
        let e = EngineState {
            active: false,
            frozen: false,
            scene: None,
            media: None,
            static_wallpaper: "C:\\Users\\you\\Pictures\\kept.jpg".into(),
        };
        save_engine(&t.state(), &e).unwrap();
        let back = load_engine(&t.state());
        assert!(!back.active);
        assert!(back.scene.is_none());
        assert!(back.media.is_none());
        assert_eq!(back.static_wallpaper, "C:\\Users\\you\\Pictures\\kept.jpg");
    }

    #[test]
    fn missing_engine_file_loads_default() {
        let t = TestDir::new();
        let e = load_engine(&t.state());
        assert!(!e.active);
        assert!(e.scene.is_none());
        assert!(e.media.is_none());
        assert!(e.static_wallpaper.is_empty());
    }

    #[test]
    fn corrupted_engine_file_falls_back_to_default() {
        let t = TestDir::new();
        std::fs::write(engine_path(&t.state()), "{ not valid json !!").unwrap();
        let e = load_engine(&t.state());
        assert!(
            !e.active,
            "corrupt file must degrade to the default, not panic"
        );
    }
}
