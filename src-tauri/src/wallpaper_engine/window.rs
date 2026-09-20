// window — extracted from wallpaper_engine.rs (V2 pillar 2, zero behavior change).
use super::render::{scene_html, scene_html_transition};
use super::scenes::SceneConfig;
use super::state::EngineState;
use crate::error::AppError;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, FindWindowW, SendMessageTimeoutW, SetParent, SetWindowPos, HWND_BOTTOM,
    SMTO_NORMAL, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSENDCHANGING, SWP_NOSIZE,
};

pub const WALLPAPER_WINDOW_LABEL: &str = "reforge-wallpaper";

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------

/// The window the desktop paints its background on — the right parent for a
/// wallpaper window so it renders *behind* the desktop icons.
///
/// Technique: find Progman and ask the shell to materialize the icon-layer
/// WorkerW (message 0x052C — a harmless no-op when it already exists). The
/// Win8+ layout then has two WorkerW windows: one hosting `SHELLDLL_DefView`
/// (the icon layer) and an empty one directly behind it (the background
/// layer). We parent into that background WorkerW; if the shell hasn't
/// created one, we fall back to Progman, which is always behind everything.
/// Crucially we never parent into `SHELLDLL_DefView` itself: that is the
/// desktop-icon container, and a wallpaper child stacked inside it can sit
/// *above* the icon list (the original above-icons bug).
pub(crate) fn desktop_background_parent() -> Option<HWND> {
    unsafe {
        let prog: Vec<u16> = "Progman\0".encode_utf16().collect();
        let progman = FindWindowW(PCWSTR(prog.as_ptr()), None).ok()?;
        let mut result: usize = 0;
        let _ = SendMessageTimeoutW(
            progman,
            0x052C,
            WPARAM(0),
            LPARAM(0),
            SMTO_NORMAL,
            1000,
            Some(&mut result),
        );
        Some(find_background_workerw().unwrap_or(progman))
    }
}

/// Enumerate top-level `WorkerW` windows and return the empty background layer
/// that sits behind the desktop icons: after the 0x052C spawn, the WorkerW
/// that hosts `SHELLDLL_DefView` is the *icon* layer, and the WorkerW that
/// follows it in z-order is the wallpaper layer (Win8+ layout). Returns None
/// when the shell hasn't created one, so the caller can fall back to Progman.
fn find_background_workerw() -> Option<HWND> {
    unsafe {
        let cls: Vec<u16> = "WorkerW\0".encode_utf16().collect();
        let shell: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
        let mut after: Option<HWND> = None;
        loop {
            let hwnd = match FindWindowExW(None, after, PCWSTR(cls.as_ptr()), None) {
                Ok(hwnd) => hwnd,
                Err(_) => return None,
            };
            if FindWindowExW(Some(hwnd), None, PCWSTR(shell.as_ptr()), None).is_ok() {
                // icon layer located — the background WorkerW is the next one
                // in z-order (directly behind it)
                return FindWindowExW(None, Some(hwnd), PCWSTR(cls.as_ptr()), None).ok();
            }
            after = Some(hwnd);
        }
    }
}

pub(crate) fn virtual_screen() -> (i32, i32, i32, i32) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXSCREEN, SM_CXVIRTUALSCREEN, SM_CYSCREEN, SM_CYVIRTUALSCREEN,
        SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
    };
    unsafe {
        let w = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        if w == 0 || h == 0 {
            (
                0,
                0,
                GetSystemMetrics(SM_CXSCREEN),
                GetSystemMetrics(SM_CYSCREEN),
            )
        } else {
            (x, y, w, h)
        }
    }
}

pub(crate) fn open_window(
    app: &tauri::AppHandle,
    scene: &SceneConfig,
    transition_from: Option<&SceneConfig>,
) -> Result<(), AppError> {
    let (x, y, w, h) = virtual_screen();
    let html = match transition_from {
        Some(from) => scene_html_transition(from, scene),
        None => scene_html(scene),
    };
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Command(e.to_string()))?;
    let file = dir.join("wallpaper_scene.html");
    std::fs::write(&file, html).map_err(|e| AppError::Command(e.to_string()))?;
    let url =
        tauri::Url::from_file_path(&file).map_err(|_| "invalid wallpaper file url".to_string())?;

    // Build + parent-into-desktop through the webview gate (webview_gate.rs):
    // at boot this can run from the deferred restore while the frontend's
    // overlay spawn is mid-creation on the main thread — two WebView2
    // creations in flight deadlock. The gate serializes them.
    let app = app.clone();
    let result = crate::webview_gate::run(move || -> Result<(), AppError> {
        let win =
            WebviewWindowBuilder::new(&app, WALLPAPER_WINDOW_LABEL, WebviewUrl::External(url))
                .title("Reforge Wallpaper")
                .decorations(false)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .closable(true)
                .skip_taskbar(true)
                .shadow(false)
                .focused(false)
                .always_on_bottom(true)
                .inner_size(w as f64, h as f64)
                .position(x as f64, y as f64)
                .build()
                .map_err(|e| AppError::Command(format!("wallpaper window: {}", e)))?;

        if let Ok(hwnd) = win.hwnd() {
            // tauri's HWND comes from its own windows crate version; convert to ours
            let hwnd = windows::Win32::Foundation::HWND(hwnd.0);
            if let Some(parent) = desktop_background_parent() {
                unsafe {
                    let _ = SetParent(hwnd, Some(parent));
                    // No SWP_NOZORDER here: HWND_BOTTOM must actually take effect
                    // so the wallpaper sits under the icon layer, and we never
                    // activate it (it must not steal focus from the user's app).
                    let _ = SetWindowPos(
                        hwnd,
                        Some(HWND_BOTTOM),
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE
                            | SWP_NOSIZE
                            | SWP_NOACTIVATE
                            | SWP_NOOWNERZORDER
                            | SWP_NOSENDCHANGING,
                    );
                }
            }
        }
        Ok(())
    });
    if let Some(Err(e)) = &result {
        tracing::error!("wallpaper scene window failed to open: {e}");
    }
    result.unwrap_or(Ok(())) // queued behind an in-flight creation — opens right after
}

pub(crate) fn close_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(WALLPAPER_WINDOW_LABEL) {
        let _ = win.close();
    }
}

// ---------------------------------------------------------------------------
// Battery-saver / fullscreen monitor
// ---------------------------------------------------------------------------

/// P3-11 — battery etiquette: true when Windows battery saver is on OR the
/// system is on battery (ACLineStatus == 0) at or below 25% charge. The flag
/// check alone isn't enough — Windows only auto-enables the saver if the user
/// hasn't turned the auto-threshold off, so a hard low-battery pause protects
/// the last charge regardless. (BatteryLifePercent is 255 when unknown.)
pub(crate) fn battery_saver_on() -> bool {
    unsafe {
        use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
        let mut st: SYSTEM_POWER_STATUS = std::mem::zeroed();
        if GetSystemPowerStatus(&mut st).is_ok() {
            // BATTERY_SAVER_MODE_ON = 0x8
            if st.SystemStatusFlag & 0x8 != 0 {
                return true;
            }
            st.ACLineStatus == 0 && st.BatteryLifePercent <= 25
        } else {
            false
        }
    }
}

/// Shared pause signal for anything that should stop churning while the user
/// is busy: battery saver or a fullscreen app/game is focused. Used by the
/// engine monitor and the static-wallpaper slideshow (S3.11).
pub(crate) fn rotation_paused() -> bool {
    battery_saver_on() || fullscreen_app_active()
}

/// A foreground window covering the whole virtual screen is a fullscreen app or
/// game — pause the wallpaper so it doesn't burn GPU behind it. Maximized
/// windows leave the taskbar visible, so they don't match (work area < screen).
/// Also used by the widget auto-hide (S9.4): widgets duck while a fullscreen
/// app has focus.
pub(crate) fn fullscreen_app_active() -> bool {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetForegroundWindow, GetWindowRect,
    };
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return false;
        }
        let mut cls = [0u16; 64];
        let n = GetClassNameW(hwnd, &mut cls);
        let class = String::from_utf16_lossy(&cls[..n.max(0) as usize]);
        // desktop / taskbar / our own shell aren't fullscreen apps
        if class == "Progman"
            || class == "WorkerW"
            || class == "Shell_TrayWnd"
            || class == "Windows.UI.Core.CoreWindow"
        {
            return false;
        }
        let (x, y, w, h) = virtual_screen();
        let mut rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return false;
        }
        let rw = rect.right - rect.left;
        let rh = rect.bottom - rect.top;
        rw >= w - 4 && rh >= h - 4 && rect.left >= x - 4 && rect.top >= y - 4
    }
}

pub fn spawn_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(20));
            // A user freeze always wins over the automatic resume logic — otherwise
            // the 20s loop would silently unfreeze a wallpaper the user paused.
            let dir = app.path().app_data_dir().ok();
            let frozen = dir
                .as_ref()
                .map(|d| {
                    let e: EngineState = crate::storage::load_json(
                        &d.join("wallpaper_engine.json"),
                        EngineState::default(),
                    );
                    e.frozen
                })
                .unwrap_or(false);
            let paused = frozen || rotation_paused();
            let app2 = app.clone();
            let app3 = app2.clone();
            let _ = app2.run_on_main_thread(move || {
                if let Some(win) = app3.get_webview_window(WALLPAPER_WINDOW_LABEL) {
                    let _ = win.eval(format!("window.__setPaused({})", paused));
                }
            });
        }
    });
}
