// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod pty;
mod project;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
