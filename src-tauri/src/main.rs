// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod pty;
mod project;
mod snippet;
mod settings;

use tauri::Manager;
use std::env;

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .map_err(|e| format!("Failed to get home directory: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(pty::PtyManager::new())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_home_dir,
            pty::create_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::kill_pty,
            project::list_projects,
            project::add_project,
            project::remove_project,
            project::update_project,
            snippet::list_snippets,
            snippet::add_snippet,
            snippet::remove_snippet,
            snippet::get_snippet,
            snippet::update_snippet,
            settings::get_settings,
            settings::save_settings,
            settings::log_session_output,
            settings::get_session_log,
            settings::list_session_logs,
            settings::delete_session_log,
            settings::clear_all_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
