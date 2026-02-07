// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod git;
mod project;
mod pty;
mod settings;
mod sharing;
mod snippet;

use std::env;
use std::fs;
use serde::{Deserialize, Serialize};
#[cfg(debug_assertions)]
use tauri::Manager;

#[derive(Serialize, Deserialize)]
struct FileMetadata {
    is_dir: bool,
    is_file: bool,
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .map_err(|e| format!("Failed to get home directory: {}", e))
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    Ok(FileMetadata {
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(pty::PtyManager::new())
        .manage(sharing::SharingState::new())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_home_dir,
            get_file_metadata,
            pty::create_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::kill_pty,
            project::list_projects,
            project::add_project,
            project::remove_project,
            project::update_project,
            project::list_categories,
            project::add_category,
            project::remove_category,
            project::update_category,
            project::set_project_category,
            project::load_project_env,
            project::save_project_env,
            project::get_project_env_vars,
            project::update_project_env_vars,
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
            settings::save_session_state,
            settings::load_session_state,
            git::git_status,
            git::git_branches,
            git::git_log,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_checkout,
            git::git_discard,
            sharing::start_session_sharing,
            sharing::stop_session_sharing,
            sharing::get_sharing_status,
            sharing::find_shared_session,
            sharing::list_shared_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
