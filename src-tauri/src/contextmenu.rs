use crate::error::AppError;
use crate::state::AppState;
use serde_json::json;
use std::path::Path;
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

/// D1 — desktop right-click themer. Two verbs under
/// `HKCU\Software\Classes\DesktopBackground\shell\Reforge.Look` that relaunch
/// this exe with `--view` deep-link flags. Install AND remove both log undo
/// entries; every registry write happens after its entry is logged.
const MENU_KEY: &str = r"Software\Classes\DesktopBackground\shell\Reforge.Look";

/// Build the exact command line a verb runs. Pure so tests pin it:
/// quoted exe, one `--view` flag, PowerShell-escaped.
fn menu_command(exe: &Path, view: &str) -> String {
    format!(
        "\"{}\" --view {}",
        exe.to_string_lossy().replace('\'', "''"),
        view
    )
}

fn verbs(exe: &Path) -> Vec<(&'static str, String, String)> {
    vec![
        (
            "Apply Reforge look",
            menu_command(exe, "makeover"),
            "Apply a Reforge look from the Makeover wizard".to_string(),
        ),
        (
            "Set wallpaper",
            menu_command(exe, "styles"),
            "Open Style Studio to pick a wallpaper".to_string(),
        ),
    ]
}

#[tauri::command]
pub fn install_context_menu(state: tauri::State<'_, AppState>) -> Result<String, AppError> {
    let exe = std::env::current_exe().map_err(|e| AppError::Command(e.to_string()))?;
    crate::undo::log_entry(
        &state,
        "context_menu_added",
        "Added Reforge verbs to the desktop right-click menu".into(),
        json!({ "verbs": ["Apply Reforge look", "Set wallpaper"] }),
        true,
    )?;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(MENU_KEY)
        .map_err(|e| AppError::Command(format!("create context menu key: {}", e)))?;
    key.set_value("", &"Reforge")
        .and_then(|_| key.set_value("Icon", &exe.to_string_lossy().to_string()))
        .map_err(|e| AppError::Command(format!("write context menu key: {}", e)))?;
    for (verb, command, muiverb) in verbs(&exe) {
        let sub = format!("{}\\{}", MENU_KEY, verb.replace(' ', ""));
        let (vkey, _) = hkcu
            .create_subkey(&sub)
            .map_err(|e| AppError::Command(format!("create verb {}: {}", verb, e)))?;
        vkey.set_value("", &verb)
            .and_then(|_| vkey.set_value("MUIVerb", &muiverb))
            .map_err(|e| AppError::Command(format!("write verb {}: {}", verb, e)))?;
        let (ckey, _) = hkcu
            .create_subkey(format!("{}\\command", sub))
            .map_err(|e| AppError::Command(format!("create command {}: {}", verb, e)))?;
        ckey.set_value("", &command)
            .map_err(|e| AppError::Command(format!("write command {}: {}", verb, e)))?;
    }
    Ok("Desktop right-click verbs installed — revert anytime from History.".into())
}

#[tauri::command]
pub fn remove_context_menu(state: tauri::State<'_, AppState>) -> Result<String, AppError> {
    crate::undo::log_entry(
        &state,
        "context_menu_removed",
        "Removed Reforge verbs from the desktop right-click menu".into(),
        json!({}),
        true,
    )?;
    RegKey::predef(HKEY_CURRENT_USER)
        .delete_subkey_all(MENU_KEY)
        .map_err(|e| AppError::Command(format!("remove context menu key: {}", e)))?;
    Ok("Desktop right-click verbs removed.".into())
}

#[cfg(test)]
mod menu_tests {
    use super::*;

    #[test]
    fn verb_commands_quote_exe_and_pin_view() {
        let exe = Path::new(r"C:\Apps\Reforge\reforge.exe");
        assert_eq!(
            menu_command(exe, "makeover"),
            r#""C:\Apps\Reforge\reforge.exe" --view makeover"#
        );
        assert_eq!(
            menu_command(exe, "styles"),
            r#""C:\Apps\Reforge\reforge.exe" --view styles"#
        );
    }

    #[test]
    fn verb_commands_escape_single_quotes() {
        let exe = Path::new(r"C:\o'hara\reforge.exe");
        assert_eq!(
            menu_command(exe, "makeover"),
            r#""C:\o''hara\reforge.exe" --view makeover"#
        );
    }

    #[test]
    fn two_verbs_with_distinct_views() {
        let exe = Path::new(r"C:\Apps\reforge.exe");
        let vs = verbs(exe);
        assert_eq!(vs.len(), 2);
        assert!(vs
            .iter()
            .any(|(v, c, _)| *v == "Apply Reforge look" && c.ends_with("--view makeover")));
        assert!(vs
            .iter()
            .any(|(v, c, _)| *v == "Set wallpaper" && c.ends_with("--view styles")));
    }
}
