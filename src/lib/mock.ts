// Mock backend — browser-preview only (NEXT_UPDATE_PLAN Phase B1).
// This module only ships in dev/preview: api.ts dynamic-imports it when
// IS_TAURI is false, so the production Tauri bundle never contains it.
// The command set and store mirror the Rust backend (api.test.ts guards this).
import { store, delay, persistStore } from "./mock/store";
import { handle as handleLook } from "./mock/look";
import { handle as handleClean } from "./mock/clean";
import { handle as handleTune } from "./mock/tune";
import { handle as handleSafe } from "./mock/safe";
import { handle as handleHistory } from "./mock/history";
import { handle as handleSocial } from "./mock/social";
import { handle as handleShare } from "./mock/share";
export { SCENES } from "./mock/store";

async function mockCallInner<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  await delay(200);
  const s = store;
  switch (cmd) {
    case "get_theme_state":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_accent_color":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_theme_mode":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_transparency":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_wallpapers":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_wallpaper":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_monitor_wallpaper":
      return handleLook(cmd, s, args) as Promise<T>;
    case "list_packs":
      return handleLook(cmd, s, args) as Promise<T>;
    case "apply_pack":
      return handleLook(cmd, s, args) as Promise<T>;
    case "scan_junk":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "clean_junk":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "scan_storage_radar":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "scan_biggest_files":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "get_storage_config":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "set_storage_config":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "preview_clean_now":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "clean_now":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "scan_unused":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "delete_unused":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "recycle_bin_state":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "empty_recycle_bin":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "windows_old_info":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "swap_file_sizes":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "big_dupe_groups":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "mock_reset_storage":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "list_startup":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "toggle_startup":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_system_info":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_health_score":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "extract_palette":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_undo_log":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_undo_digest":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_performance":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_user_folders":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "scan_duplicates":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "remove_duplicates":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "resolve_duplicate_group":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "empty_trash":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "trash_size":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "scan_storage":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "preview_sort":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "apply_sort":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "list_cursor_schemes":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_cursor_state":
      return handleLook(cmd, s, args) as Promise<T>;
    case "apply_cursor_scheme":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_security_audit":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "run_maintenance":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "run_autopilot":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "schedule_look":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "diff_pack":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "list_reports":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "archive_report":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "export_profile":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "import_profile":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "export_widget_share":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "import_widget_share":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "revert_entry":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "snapshot_now":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "list_snapshots":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "restore_snapshot":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "factory_fresh":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "list_wallpaper_scenes":
      return handleLook(cmd, s, args) as Promise<T>;
    case "save_custom_scene":
      return handleLook(cmd, s, args) as Promise<T>;
    case "delete_custom_scene":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_wallpaper_engine_state":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_animated_wallpaper":
      return handleLook(cmd, s, args) as Promise<T>;
    case "stop_animated_wallpaper":
      return handleLook(cmd, s, args) as Promise<T>;
    case "freeze_wallpaper":
      return handleLook(cmd, s, args) as Promise<T>;
    case "list_widgets":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "create_widget":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "save_widget_layout":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_widgets_settings":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_widgets_settings":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_widget_stats":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "widget_open_view":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "reset_widget_layout":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "save_widget_note":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "update_widget":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_widget_visible":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_all_widgets_visible":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "remove_widget":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "list_bloatware":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "uninstall_bloatware":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_memory_hogs":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "end_process":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "scan_orphaned_entries":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "remove_orphaned_entry":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "list_power_plans":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "set_active_power_plan":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "audit_scheduled_tasks":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_boot_stats":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "audit_browser_extensions":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "audit_file_associations":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "reset_file_association":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "list_drivers":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "list_smart_folders":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "create_smart_folder":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "remove_smart_folder":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "run_smart_folder":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "plan_archive":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "apply_archive":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "preview_rename":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "apply_rename":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "organize_screenshots":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "list_stale_downloads":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "delete_stale_downloads":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "flag_stale_apps":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "scan_cloud_duplicates":
      return handleClean(cmd, s, args, mockCall) as Promise<T>;
    case "get_permissions":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "set_permission":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "get_browser_privacy":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "set_browser_policy":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "get_usb_history":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "get_clipboard_history":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "clear_clipboard_history":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "toggle_clipboard_pin":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_app_list":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "launch_app":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "list_macros":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "create_macro":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "remove_macro":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "toggle_macro":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_focus_mode":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_focus_state":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_ram_cleanup":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_bandwidth_hogs":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "list_wifi_profiles":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "forget_wifi_profile":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "reset_network":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_game_mode":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_game_mode":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "list_game_profiles":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "save_game_profile":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "delete_game_profile":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "list_app_look_rules":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_app_look_rules":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "apply_game_profile":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_power_state":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "set_power_plan":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "set_screen_off_timeout":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "set_hibernate":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_focus_session":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "start_focus_session":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "stop_focus_session":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_accessibility_state":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_accessibility_state":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_stream_layout":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_stream_layout":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_display_info":
      return handleLook(cmd, s, args) as Promise<T>;
    case "list_display_profiles":
      return handleLook(cmd, s, args) as Promise<T>;
    case "save_display_profile":
      return handleLook(cmd, s, args) as Promise<T>;
    case "apply_display_profile":
      return handleLook(cmd, s, args) as Promise<T>;
    case "delete_display_profile":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_onboarding_state":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "set_onboarding_state":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_favorites":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "set_favorite":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_automation_config":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "set_automation_config":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "run_due_maintenance":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "set_blue_light":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_dashboard_metrics":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_dashboard_summary":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_perf_history":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_resource_leaderboard":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "get_battery_health":
      return handleHistory(cmd, s, args, mockCall) as Promise<T>;
    case "marketplace_list_bundles":
      return handleShare(cmd, s, args) as Promise<T>;
    case "marketplace_import":
      return handleShare(cmd, s, args) as Promise<T>;
    case "marketplace_export_look":
      return handleShare(cmd, s, args) as Promise<T>;
    case "marketplace_export_to_path":
      return handleShare(cmd, s, args) as Promise<T>;
    case "marketplace_apply_bundle":
      return handleShare(cmd, s, args) as Promise<T>;
    case "marketplace_get_manifest":
      return handleShare(cmd, s, args) as Promise<T>;
    case "marketplace_delete_bundle":
      return handleShare(cmd, s, args) as Promise<T>;
    case "marketplace_preview_asset":
      return handleShare(cmd, s, args) as Promise<T>;
    case "marketplace_import_components":
      return handleShare(cmd, s, args) as Promise<T>;
    case "list_vpn_connections":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "vpn_connect":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "vpn_disconnect":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "list_video_wallpapers":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_video_wallpaper":
      return handleLook(cmd, s, args) as Promise<T>;
    case "stop_video_wallpaper":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_video_paused":
      return handleLook(cmd, s, args) as Promise<T>;
    case "read_image_data_url":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "bundle_diagnostics":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "media_get_transcode_status":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_transcode_config":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "set_transcode_config":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_screensaver_config":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_screensaver_config":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "get_screensaver_registry":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "preview_screensaver":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "dismiss_screensaver":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_get_taskbar_state":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_set_taskbar_size":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_set_taskbar_alignment":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_set_taskbar_autohide":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_set_taskbar_color_match":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_set_taskbar_position":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_get_pending_state":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_apply_pending_restart":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_revert_pending":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "list_sound_schemes":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_current_scheme":
      return handleLook(cmd, s, args) as Promise<T>;
    case "apply_sound_scheme":
      return handleLook(cmd, s, args) as Promise<T>;
    case "list_sound_events":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_sound_event":
      return handleLook(cmd, s, args) as Promise<T>;
    case "preview_sound":
      return handleLook(cmd, s, args) as Promise<T>;
    case "stop_preview":
      return handleLook(cmd, s, args) as Promise<T>;
    case "import_sound_asset":
      return handleLook(cmd, s, args) as Promise<T>;
    case "save_current_scheme":
      return handleLook(cmd, s, args) as Promise<T>;
    case "list_installed_fonts":
      return handleLook(cmd, s, args) as Promise<T>;
    case "list_font_substitutions":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_font_substitution":
      return handleLook(cmd, s, args) as Promise<T>;
    case "install_user_font":
      return handleLook(cmd, s, args) as Promise<T>;
    case "remove_user_font":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_lock_screen_state":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_lock_screen_image":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_lock_screen_slideshow":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_lock_screen_spotlight":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_lock_screen_hide_apps":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_capability_matrix":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "get_wallpaper_slideshow":
      return handleLook(cmd, s, args) as Promise<T>;
    case "set_wallpaper_slideshow":
      return handleLook(cmd, s, args) as Promise<T>;
    case "skip_slideshow":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_wallpaper_history":
      return handleLook(cmd, s, args) as Promise<T>;
    case "apply_style":
      return handleLook(cmd, s, args) as Promise<T>;
    case "get_applied_style":
      return handleLook(cmd, s, args) as Promise<T>;
    case "security_get_health_status":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_get_scan_history":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_list_threats":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_audit_autorun_threat_surface":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_get_cfa_status":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_list_asr_rules":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_trigger_scan":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_update_definitions":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_restore_threat":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_remove_threat":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_set_cfa_mode":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_set_asr_rule_action":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_get_defender_detail":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_list_registered_products":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_open_thirdparty_scanner":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_manage_exclusions":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_manage_cfa_allowlist":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_request_temporary_rt_disable":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_get_rt_disable_remaining_time":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_cancel_rt_disable_early":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_get_scan_progress":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_get_digest":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_get_threat_detail":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "security_get_flagged_entry_detail":
      return handleSafe(cmd, s, args, mockCall) as Promise<T>;
    case "get_splash_config":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_splash_config":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "set_splash_login_launch":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "dismiss_splash":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "shell_get_taskbar_capabilities":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "rgb_detect":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "rgb_set_static":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "rgb_restore_current_mode":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "rgb_set_zone_static":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_get_state":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_set_enabled":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_set_config":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_bump_count":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_unlock_achievement":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_get_stats":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_capture_screen":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_save_png":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_spawn_overlay":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "fun_close_overlay":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "list_config_files":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "list_registry_values":
      return handleTune(cmd, s, args, mockCall) as Promise<T>;
    case "read_registry_value": {
      // X-7 — mirrors system::read_registry_value_in: only exact
      // (path, name) allowlist pairs resolve; anything else rejects like the
      // Rust AppError::Invalid so the preview honors the same boundary.
      // (Unregistered in lib.rs invoke_handler until the integration wave.)
      const path = String(args.path ?? "");
      const name = String(args.name ?? "");
      const canned: Record<string, { value: string; kind: string }> = {
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize!AppsUseLightTheme": { value: "0", kind: "DWORD" },
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize!ColorPrevalence": { value: "1", kind: "DWORD" },
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced!TaskbarAl": { value: "1", kind: "DWORD" },
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced!TaskbarSi": { value: "1", kind: "DWORD" },
      };
      const hit = canned[`${path.trim()}!${name.trim()}`];
      if (!hit) throw new Error(`Registry path is not in the read-only allowlist.`);
      return { path: path.trim(), name: name.trim(), ...hit } as unknown as Promise<T>;
    }
    case "get_update_config":
      return handleShare(cmd, s, args) as Promise<T>;
    case "set_update_config":
      return handleShare(cmd, s, args) as Promise<T>;
    case "check_for_update":
      return handleShare(cmd, s, args) as Promise<T>;
    case "download_update":
      return handleShare(cmd, s, args) as Promise<T>;
    case "apply_staged_update":
      return handleShare(cmd, s, args) as Promise<T>;
    case "fun_hotkey_state":
      return handleSocial(cmd, s, args) as Promise<T>;
    case "mock_set_update_result":
      return handleShare(cmd, s, args) as Promise<T>;
    case "take_launch_view":
      return handleShare(cmd, s, args) as Promise<T>;
    case "install_context_menu":
      return handleShare(cmd, s, args) as Promise<T>;
    case "remove_context_menu":
      return handleShare(cmd, s, args) as Promise<T>;
    default:
      throw new Error(`no mock for command: ${cmd}`);
  }
}

// Persist preview state after mock calls — debounced so rapid slider drags
// don't hammer localStorage on every tick (C2.4), flushed on unload.
let persistTimer: number | undefined;
function schedulePersist() {
  if (persistTimer !== undefined) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => persistStore(), 200);
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (persistTimer !== undefined) {
      window.clearTimeout(persistTimer);
      persistStore();
    }
  });
}

/** Mock dispatcher (renamed from mockCall in api.ts). Schedules persistence
 *  after every successful call so preview survives reloads. */
export async function mockCall<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await mockCallInner<T>(cmd, args);
  schedulePersist();
  return r;
}

