use std::io::Write as _;
use tauri::Manager;

// Startup log: every boot appends to %APPDATA%\com.reforge.app\startup.log so
// startup hangs/crashes are diagnosable without a debugger. A tracing
// subscriber writes through this file (E3 — replaces the ad-hoc append_log);
// the panic hook ALSO falls back to a direct file write so a mid-panic
// subscriber failure can never lose the trail.
fn startup_log_path() -> std::path::PathBuf {
    dirs::data_dir()
        .unwrap_or_default()
        .join("com.reforge.app")
        .join("startup.log")
}

/// tracing-subscriber writer that appends to the startup log file.
#[derive(Clone)]
struct LogFile(std::sync::Arc<std::sync::Mutex<std::fs::File>>);

impl std::io::Write for LogFile {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        // poison just means another thread panicked — keep logging through it
        self.0.lock().unwrap_or_else(|p| p.into_inner()).write(buf)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.0.lock().unwrap_or_else(|p| p.into_inner()).flush()
    }
}

impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for LogFile {
    type Writer = LogFile;
    fn make_writer(&'a self) -> Self::Writer {
        self.clone()
    }
}

/// F-B: Mica window material (Windows 11) — the chrome is DOM over a Mica
/// backdrop. The dark flag follows the current app mode so Theme Studio's
/// dark/light override moves the material with it; failures are ignored
/// (fallback: the plain window renders fine — documented in DESIGN.md).
pub fn apply_mica(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let dark = crate::theme::current_mode() == "dark";
        let _ = window_vibrancy::apply_mica(&win, Some(dark));
    }
}

mod accessibility;

mod applooks;
mod automation;
mod capability;
mod cleanup;
mod cmd;
mod contextmenu;
mod cursors;
mod dashboard;
mod displays;
mod duplicates;
mod error;
mod favorites;
mod files;
mod fonts;
mod fun;
mod gaming;
mod lockscreen;
mod maintenance;
mod marketplace;
mod migrations;
mod network;
mod onboarding;
mod organize;
mod packs;
mod palette;
mod perf;
mod power;
mod productivity;
mod profile;
mod restore;
mod rgb;
mod saves;
mod screensaver;
mod security;
mod security_center;
mod shell;
mod sounds;
mod splash;
mod startup;
mod state;
mod storage;
mod styles;
mod system;
mod theme;
mod transcode;
mod tuneup;
mod undo;
mod updater;
mod wallpaper;
mod wallpaper_engine;
mod wallpaper_static;
mod wallpaper_video;
mod webview_gate;
mod widgets;

use state::AppState;

/// X-7 — startup CLI actions, parsed pure so unit tests cover every flag.
/// `/s` matches case-insensitively (Windows passes `/S`); everything else is
/// exact, preserving the pre-existing `--version`/`-s` behavior.
#[derive(Debug, PartialEq)]
enum CliAction {
    Version,
    Screensaver,
    Help,
}

fn parse_cli_arg(arg: &str) -> Option<CliAction> {
    if arg.eq_ignore_ascii_case("/s") || arg == "-s" {
        return Some(CliAction::Screensaver);
    }
    match arg {
        "--version" | "-v" | "-V" => Some(CliAction::Version),
        "--help" | "-h" | "-?" | "/?" => Some(CliAction::Help),
        _ => None,
    }
}

fn cli_help_text() -> String {
    format!(
        "Reforge {} — PC Makeover (Windows 10 & 11)\n\
         Usage: reforge [option]\n\
         \u{20} --version, -v   print the version and exit\n\
         \u{20} --help, -h      show this help and exit\n\
         \u{20} --view <name>   open directly on a view (dashboard, makeover, styles, marketplace, ...)\n\
         \u{20} /s              run as screensaver (used by the Windows idle timeout)\n\
         No option opens the Reforge window.\n\
         Config + state live in %APPDATA%\\com.reforge.app (see Settings → Advanced).",
        env!("CARGO_PKG_VERSION")
    )
}

/// D1 — `--view <name>` deep-link flag (used by the desktop right-click
/// verbs). Pure + allowlisted: unknown views yield None and the app opens
/// normally. Takes the full argv slice because the flag consumes a value.
fn parse_view_flag(args: &[String]) -> Option<String> {
    const VIEWS: &[&str] = &[
        "dashboard",
        "makeover",
        "styles",
        "marketplace",
        "performance",
        "tuneup",
        "organize",
        "security",
        "history",
        "settings",
        "productivity",
        "displays",
        "network",
        "gaming",
        "power",
        "accessibility",
        "widgets",
    ];
    let mut iter = args.iter();
    while let Some(a) = iter.next() {
        if a == "--view" {
            if let Some(v) = iter.next() {
                if VIEWS.contains(&v.as_str()) {
                    return Some(v.clone());
                }
            }
            return None;
        }
    }
    None
}

/// One-shot launch view, consumed by the frontend at startup.
pub struct LaunchView(pub std::sync::Mutex<Option<String>>);

#[tauri::command]
fn take_launch_view(state: tauri::State<'_, LaunchView>) -> Option<String> {
    state.0.lock().ok()?.take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // S12.4 + X-7 — startup flags print and exit cleanly before any window
    // or log setup, so they're instant and side-effect free.
    match std::env::args().skip(1).find_map(|a| parse_cli_arg(&a)) {
        Some(CliAction::Version) => {
            println!(
                "Reforge {} ({} {})",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                std::env::consts::ARCH
            );
            std::process::exit(0);
        }
        Some(CliAction::Help) => {
            println!("{}", cli_help_text());
            std::process::exit(0);
        }
        // E4.6 — when the OS launches us as the screensaver (idle timeout
        // runs the registered exe with /s), open the scene fullscreen.
        Some(CliAction::Screensaver) => return run_screensaver_app(),
        None => {}
    }
    let log_path = startup_log_path();
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    // tracing subscriber → startup.log (E3). If the file can't be opened the
    // app still runs; logs just go nowhere.
    if let Ok(file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        tracing_subscriber::fmt()
            .with_writer(LogFile(std::sync::Arc::new(std::sync::Mutex::new(file))))
            .with_ansi(false)
            .with_target(false)
            .init();
    }
    tracing::info!("app starting");
    // log panics so a crash leaves a trail — the direct file write stays as
    // the robust fallback in case the subscriber is torn down mid-panic
    let panic_path = log_path.clone();
    std::panic::set_hook(Box::new(move |info| {
        tracing::error!("PANIC: {}", info);
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&panic_path)
            .and_then(|mut f| writeln!(f, "[{}] PANIC: {}", crate::storage::now_millis(), info));
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(move |app| {
            let dir = app.path().app_data_dir()?;
            tracing::info!("setup: data dir ready");
            std::fs::create_dir_all(&dir)?;
            std::fs::create_dir_all(dir.join("snapshots"))?;
            std::fs::create_dir_all(dir.join("wallpapers"))?;
            std::fs::create_dir_all(dir.join("packs"))?;
            std::fs::create_dir_all(dir.join("lockscreen"))?;
            std::fs::create_dir_all(dir.join("sounds"))?;
            let state_managed = AppState {
                data_dir: dir.clone(),
            };
            // S12.5 — versioned state: run pending migrations BEFORE any code
            // reads a state file, then stamp the schema version.
            match migrations::run_migrations(&state_managed) {
                Ok(v) => tracing::info!("state schema v{v} ready"),
                Err(e) => tracing::error!("state migration failed: {e}"),
            }
            app.manage(state_managed);
            // RGB restore-on-exit: session tracking for touched devices (M-2)
            app.manage(rgb::RgbSession::default());
            // D1 — deep-link view from `--view` (context-menu verbs); the
            // frontend consumes it once at startup via take_launch_view.
            let argv: Vec<String> = std::env::args().skip(1).collect();
            app.manage(LaunchView(std::sync::Mutex::new(parse_view_flag(&argv))));
            let handle = app.handle().clone();
            // F-B: Mica window material behind the content pane
            apply_mica(&handle);
            // fun-widgets bridge: the app handle for event emission, hotkey
            // restore for persisted widgets, and the stats poll thread
            fun::set_app_handle(handle.clone());
            fun::sync_hotkeys_at_startup(&handle);
            fun::stats::start(handle.clone());
            let handle_deferred = handle.clone();
            let state_main = AppState {
                data_dir: dir.clone(),
            };
            let state_bg = AppState {
                data_dir: dir.clone(),
            };

            // ---- Deferred startup: do everything that can block on a 1s-delayed
            // ---- thread so the event loop starts first and the app never hangs.
            // S12.6 — the splash → main handoff timing is logged (ms per step)
            // so a regression in release-build timing is visible in startup.log.
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(1500));
                let t0 = std::time::Instant::now();
                tracing::info!("deferred startup: begin");

                // safe-mode fallback for shell changes (runs tasklist)
                let _ = shell::check_safe_mode_fallback(&state_bg);

                // restore persistent UI layers (need the app handle on main thread).
                // S8.7 — one plan (engine + widgets + automation state files)
                // consumed by one executor, so a reboot restores exactly what
                // was left running and the plan is unit-testable.
                let h2 = handle_deferred.clone();
                let plan = restore::plan_restore(&state_main.data_dir);
                let _ = handle_deferred.run_on_main_thread(move || {
                    tracing::info!("deferred startup: restoring UI layers on main thread");
                    restore::execute_restore(&h2, &state_main.data_dir, plan);
                    splash::spawn_splash(&h2, &state_main);
                });
                // S12.6 — measure the handoff: shell checks + restore plan
                // + main-thread restore + splash spawn.
                tracing::info!("deferred startup: done in {}ms", t0.elapsed().as_millis());
            });

            // ---- Background threads (fast to start, never block setup) ----
            productivity::spawn_clipboard_monitor(dir.clone());
            productivity::spawn_macro_monitor(dir.clone());
            wallpaper_engine::spawn_monitor(handle.clone());
            wallpaper_static::spawn_rotation(AppState {
                data_dir: dir.clone(),
            });
            // S9.4 — widgets duck while a fullscreen app has focus
            widgets::spawn_autohide_monitor(
                handle.clone(),
                AppState {
                    data_dir: dir.clone(),
                },
            );
            // S10.3 — optimize on launch: apply a profile when its game starts
            gaming::spawn_game_watcher(
                handle.clone(),
                AppState {
                    data_dir: dir.clone(),
                },
            );
            // D1 — per-app looks: apply a pack when its app starts
            applooks::spawn_app_look_watcher(
                handle.clone(),
                AppState {
                    data_dir: dir.clone(),
                },
            );
            // S11 — automation threads: blue-light schedule (time-based ramp),
            // scheduled style applies, and due-maintenance (weekly junk /
            // monthly dupes with first-run grace + failure notifications).
            automation::spawn_blue_light_scheduler(AppState {
                data_dir: dir.clone(),
            });
            automation::spawn_style_scheduler(
                AppState {
                    data_dir: dir.clone(),
                },
                handle.clone(),
            );
            automation::spawn_maintenance_scheduler(
                AppState {
                    data_dir: dir.clone(),
                },
                handle.clone(),
            );

            // push live stats into stats widgets (S9.5: GPU / net up-down /
            // thermals ride the same 2s pulse as CPU/RAM/disk)
            let stat_handle = handle.clone();
            std::thread::spawn(move || {
                use std::time::Instant;
                use sysinfo::System;
                let mut sys = System::new_all();
                let mut last_net: Option<(u64, u64)> = None;
                let mut last = Instant::now();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    sys.refresh_all();
                    let now = Instant::now();
                    let dt = now.duration_since(last).as_secs_f32();
                    last = now;
                    let stats = crate::perf::sample_widget_stats(&mut sys, &mut last_net, dt);
                    let mut procs: Vec<(String, f32)> = sys
                        .processes()
                        .values()
                        .map(|p| (p.name().to_string_lossy().to_string(), p.cpu_usage()))
                        .collect();
                    procs.sort_by(|a, b| b.1.total_cmp(&a.1));
                    procs.truncate(3);
                    widgets::push_stats(&stat_handle, &stats, procs);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // capability
            capability::get_capability_matrix,
            capability::request_elevation,
            contextmenu::install_context_menu,
            contextmenu::remove_context_menu,
            take_launch_view,
            // theme
            theme::get_theme_state,
            theme::set_accent_color,
            theme::set_theme_mode,
            theme::set_transparency,
            // wallpaper
            wallpaper::get_wallpapers,
            wallpaper::set_wallpaper,
            wallpaper::set_monitor_wallpaper,
            wallpaper::resolve_wallpaper_path,
            wallpaper_static::get_wallpaper_history,
            wallpaper_static::get_wallpaper_slideshow,
            wallpaper_static::set_wallpaper_slideshow,
            wallpaper_static::skip_slideshow,
            // wallpaper engine
            wallpaper_engine::list_wallpaper_scenes,
            wallpaper_engine::save_custom_scene,
            wallpaper_engine::delete_custom_scene,
            wallpaper_engine::get_wallpaper_engine_state,
            wallpaper_engine::set_animated_wallpaper,
            wallpaper_engine::stop_animated_wallpaper,
            wallpaper_engine::freeze_wallpaper,
            wallpaper_video::list_video_wallpapers,
            wallpaper_video::set_video_wallpaper,
            wallpaper_video::stop_video_wallpaper,
            wallpaper_video::set_video_paused,
            // widgets
            widgets::list_widgets,
            widgets::create_widget,
            widgets::save_widget_note,
            widgets::update_widget,
            widgets::remove_widget,
            widgets::set_widget_visible,
            widgets::set_all_widgets_visible,
            widgets::save_widget_layout,
            widgets::reset_widget_layout,
            widgets::widget_open_view,
            widgets::get_widgets_settings,
            widgets::set_widgets_settings,
            widgets::export_widget_share,
            widgets::import_widget_share,
            perf::get_widget_stats,
            power::get_power_state,
            power::set_power_plan,
            power::set_screen_off_timeout,
            power::set_hibernate,
            gaming::list_game_profiles,
            gaming::save_game_profile,
            gaming::delete_game_profile,
            gaming::apply_game_profile,
            applooks::list_app_look_rules,
            applooks::set_app_look_rules,
            applooks::schedule_look,
            productivity::start_focus_session,
            productivity::stop_focus_session,
            productivity::get_focus_session,
            accessibility::get_accessibility_state,
            accessibility::set_accessibility_state,
            // packs
            packs::list_packs,
            packs::apply_pack,
            // styles (Style Engine)
            styles::apply_style,
            styles::get_applied_style,
            // onboarding
            onboarding::get_onboarding_state,
            onboarding::set_onboarding_state,
            // style favorites
            favorites::get_favorites,
            favorites::set_favorite,
            // cleanup
            cleanup::scan_junk,
            cleanup::clean_junk,
            // startup
            startup::list_startup,
            startup::toggle_startup,
            // tuneup
            tuneup::list_bloatware,
            tuneup::uninstall_bloatware,
            tuneup::get_memory_hogs,
            tuneup::end_process,
            tuneup::scan_orphaned_entries,
            tuneup::remove_orphaned_entry,
            tuneup::list_power_plans,
            tuneup::set_active_power_plan,
            tuneup::audit_scheduled_tasks,
            tuneup::get_boot_stats,
            tuneup::audit_browser_extensions,
            tuneup::audit_file_associations,
            tuneup::reset_file_association,
            tuneup::list_drivers,
            // system
            system::get_system_info,
            system::get_health_score,
            system::get_build_info,
            system::bundle_diagnostics,
            system::list_config_files,
            system::list_registry_values,
            system::read_registry_value,
            // palette
            palette::extract_palette,
            // perf
            perf::get_performance,
            perf::get_perf_history,
            perf::get_resource_leaderboard,
            perf::get_battery_health,
            // duplicates
            duplicates::scan_duplicates,
            duplicates::remove_duplicates,
            duplicates::resolve_duplicate_group,
            duplicates::empty_trash,
            duplicates::trash_size,
            // organize
            organize::scan_storage,
            organize::preview_sort,
            organize::apply_sort,
            // files
            files::list_smart_folders,
            files::create_smart_folder,
            files::remove_smart_folder,
            files::run_smart_folder,
            files::plan_archive,
            files::apply_archive,
            files::preview_rename,
            files::apply_rename,
            files::organize_screenshots,
            files::list_stale_downloads,
            files::delete_stale_downloads,
            files::flag_stale_apps,
            files::scan_cloud_duplicates,
            // S14 — storage liberation
            storage::scan_storage_radar,
            storage::scan_biggest_files,
            storage::get_storage_config,
            storage::set_storage_config,
            cleanup::preview_clean_now,
            cleanup::clean_now,
            files::scan_unused,
            files::delete_unused,
            saves::recycle_bin_state,
            saves::empty_recycle_bin,
            saves::windows_old_info,
            saves::swap_file_sizes,
            saves::big_dupe_groups,
            // cursors
            cursors::list_cursor_schemes,
            cursors::get_cursor_state,
            cursors::apply_cursor_scheme,
            // security
            security::get_security_audit,
            security::get_permissions,
            security::set_permission,
            security::get_browser_privacy,
            security::set_browser_policy,
            security::get_usb_history,
            // productivity
            productivity::get_clipboard_history,
            productivity::clear_clipboard_history,
            productivity::toggle_clipboard_pin,
            productivity::get_app_list,
            productivity::launch_app,
            productivity::list_macros,
            productivity::create_macro,
            productivity::remove_macro,
            productivity::toggle_macro,
            productivity::set_focus_mode,
            productivity::get_focus_state,
            productivity::get_ram_cleanup,
            // network
            network::get_bandwidth_hogs,
            network::list_wifi_profiles,
            network::forget_wifi_profile,
            network::reset_network,
            network::list_vpn_connections,
            network::vpn_connect,
            network::vpn_disconnect,
            // gaming
            gaming::get_game_mode,
            gaming::set_game_mode,
            gaming::get_stream_layout,
            gaming::set_stream_layout,
            // displays
            displays::get_display_info,
            displays::list_display_profiles,
            displays::save_display_profile,
            displays::apply_display_profile,
            displays::delete_display_profile,
            // automation
            automation::get_automation_config,
            automation::set_automation_config,
            automation::run_due_maintenance,
            automation::set_blue_light,
            // updater (S12.1)
            updater::get_update_config,
            updater::set_update_config,
            updater::check_for_update,
            updater::download_update,
            updater::apply_staged_update,
            // dashboard
            dashboard::get_dashboard_metrics,
            dashboard::get_dashboard_summary,
            // maintenance
            maintenance::run_maintenance,
            maintenance::run_autopilot,
            maintenance::list_reports,
            maintenance::archive_report,
            maintenance::get_user_folders,
            // profile
            profile::export_profile,
            profile::import_profile,
            // sounds
            sounds::list_sound_schemes,
            sounds::get_current_scheme,
            sounds::apply_sound_scheme,
            sounds::list_sound_events,
            sounds::set_sound_event,
            sounds::preview_sound,
            sounds::stop_preview,
            sounds::import_sound_asset,
            sounds::save_current_scheme,
            // lockscreen
            lockscreen::get_lock_screen_state,
            lockscreen::set_lock_screen_image,
            lockscreen::set_lock_screen_slideshow,
            lockscreen::set_lock_screen_spotlight,
            lockscreen::set_lock_screen_hide_apps,
            lockscreen::read_image_data_url,
            // fonts
            fonts::list_installed_fonts,
            fonts::list_font_substitutions,
            fonts::set_font_substitution,
            fonts::install_user_font,
            fonts::remove_user_font,
            // rgb
            rgb::rgb_detect,
            rgb::rgb_set_static,
            rgb::rgb_restore_current_mode,
            rgb::rgb_set_zone_static,
            // splash
            splash::get_splash_config,
            splash::set_splash_config,
            splash::dismiss_splash,
            splash::set_splash_login_launch,
            // marketplace
            marketplace::marketplace_list_bundles,
            marketplace::marketplace_import,
            marketplace::marketplace_export_look,
            marketplace::marketplace_export_to_path,
            marketplace::marketplace_apply_bundle,
            marketplace::marketplace_get_manifest,
            marketplace::marketplace_delete_bundle,
            marketplace::marketplace_preview_asset,
            marketplace::marketplace_import_components,
            marketplace::diff_pack,
            // shell
            shell::shell_get_taskbar_state,
            shell::shell_get_taskbar_capabilities,
            shell::shell_set_taskbar_size,
            shell::shell_set_taskbar_alignment,
            shell::shell_set_taskbar_autohide,
            shell::shell_set_taskbar_color_match,
            shell::shell_set_taskbar_position,
            shell::shell_get_pending_state,
            shell::shell_apply_pending_restart,
            shell::shell_revert_pending,
            // transcode
            transcode::media_get_transcode_status,
            transcode::get_transcode_config,
            transcode::set_transcode_config,
            // security center
            security_center::security_get_health_status,
            security_center::security_list_registered_products,
            security_center::security_get_defender_detail,
            security_center::security_trigger_scan,
            security_center::security_get_scan_progress,
            security_center::security_get_scan_history,
            security_center::security_open_thirdparty_scanner,
            security_center::security_list_threats,
            security_center::security_get_threat_detail,
            security_center::security_restore_threat,
            security_center::security_remove_threat,
            security_center::security_request_temporary_rt_disable,
            security_center::security_get_rt_disable_remaining_time,
            security_center::security_cancel_rt_disable_early,
            security_center::security_get_tamper_protection_status,
            security_center::security_manage_exclusions,
            security_center::security_get_cfa_status,
            security_center::security_set_cfa_mode,
            security_center::security_manage_cfa_allowlist,
            security_center::security_list_asr_rules,
            security_center::security_set_asr_rule_action,
            security_center::security_audit_autorun_threat_surface,
            security_center::security_get_flagged_entry_detail,
            security_center::security_update_definitions,
            security_center::security_get_digest,
            // fun widgets
            fun::fun_get_state,
            fun::fun_set_enabled,
            fun::fun_set_config,
            fun::fun_bump_count,
            fun::fun_unlock_achievement,
            fun::fun_get_stats,
            fun::fun_capture_screen,
            fun::fun_save_png,
            fun::fun_spawn_overlay,
            fun::fun_close_overlay,
            fun::fun_hotkey_state,
            // misc
            undo::get_undo_log,
            undo::get_undo_digest,
            undo::revert_entry,
            undo::snapshot_now,
            undo::list_snapshots,
            undo::restore_snapshot,
            undo::factory_fresh,
            // screensaver (E4.6)
            screensaver::get_screensaver_config,
            screensaver::set_screensaver_config,
            screensaver::get_screensaver_registry,
            screensaver::preview_screensaver,
            screensaver::dismiss_screensaver,
        ])
        .build(tauri::generate_context!())
        // tauri's canonical main entry — the app can't continue without it
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // M-2: give RGB devices their own lighting back before the
                // process ends. Best-effort; no-ops instantly when nothing
                // was touched this session.
                rgb::rgb_restore_session_on_exit(app_handle);
            }
        });
}

/// The OS launched us as the screensaver (/s arg from the idle timeout).
/// Build a minimal app: close the config-defined main window, open the scene
/// fullscreen, and let the process exit when the window closes on input.
fn run_screensaver_app() {
    let dir = std::env::var_os("APPDATA")
        .map(|d| std::path::PathBuf::from(d).join("com.reforge.app"))
        .unwrap_or_default();
    let _ = std::fs::create_dir_all(&dir);
    let data_dir = dir.clone();
    tauri::Builder::default()
        .manage(AppState { data_dir })
        .setup(move |app| {
            // Drop the default app window — screensavers are fullscreen only.
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.close();
            }
            screensaver::run_screensaver_mode(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![screensaver::dismiss_screensaver,])
        .run(tauri::generate_context!())
        // process entry — a failed event loop cannot continue, so abort with context
        .expect("screensaver mode");
}

/// X-7 CLI flag tests (kept after all items: clippy items-after-test-module).
#[cfg(test)]
mod cli_tests {
    use super::*;

    #[test]
    fn version_flags() {
        for f in ["--version", "-v", "-V"] {
            assert_eq!(parse_cli_arg(f), Some(CliAction::Version));
        }
    }

    #[test]
    fn help_flags() {
        for f in ["--help", "-h", "-?", "/?"] {
            assert_eq!(parse_cli_arg(f), Some(CliAction::Help));
        }
    }

    #[test]
    fn screensaver_flags_preserve_case_rules() {
        assert_eq!(parse_cli_arg("/s"), Some(CliAction::Screensaver));
        assert_eq!(parse_cli_arg("/S"), Some(CliAction::Screensaver));
        assert_eq!(parse_cli_arg("-s"), Some(CliAction::Screensaver));
    }

    #[test]
    fn unknown_args_run_the_app() {
        for f in ["", "--verbose", "/S ", "-S", "--VERSION"] {
            assert_eq!(parse_cli_arg(f), None);
        }
    }

    #[test]
    fn help_text_names_every_flag() {
        let h = cli_help_text();
        for token in ["--version", "--help", "--view", "/s", "%APPDATA%"] {
            assert!(h.contains(token), "help missing {token}");
        }
    }

    #[test]
    fn view_flag_accepts_only_known_views() {
        let v = |a: &[&str]| parse_view_flag(&a.iter().map(|s| s.to_string()).collect::<Vec<_>>());
        assert_eq!(v(&["--view", "makeover"]).as_deref(), Some("makeover"));
        assert_eq!(v(&["--view", "styles"]).as_deref(), Some("styles"));
        assert_eq!(v(&["--view", "evil"]), None);
        assert_eq!(v(&["--view"]), None);
        assert_eq!(v(&[]), None);
        assert_eq!(v(&["--version"]), None);
    }
}
