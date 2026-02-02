use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,       // "dark", "light", "monokai"
    pub font_size: u8,       // 10-24
    pub font_family: String, // "Consolas", "JetBrains Mono", etc.
    pub enable_logging: bool,
    pub locale: String, // "en", "ko"
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_size: 14,
            font_family: "Consolas".to_string(),
            enable_logging: true,
            locale: "ko".to_string(), // Default to Korean
        }
    }
}

/// Get settings file path (APPDATA/shellhive/settings.json)
fn get_settings_file_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or_else(|| "Failed to get data directory".to_string())?;

    let shellhive_dir = data_dir.join("shellhive");

    if !shellhive_dir.exists() {
        fs::create_dir_all(&shellhive_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    Ok(shellhive_dir.join("settings.json"))
}

/// Get logs directory path (APPDATA/shellhive/logs/)
fn get_logs_dir_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or_else(|| "Failed to get data directory".to_string())?;

    let logs_dir = data_dir.join("shellhive").join("logs");

    if !logs_dir.exists() {
        fs::create_dir_all(&logs_dir)
            .map_err(|e| format!("Failed to create logs directory: {}", e))?;
    }

    Ok(logs_dir)
}

#[tauri::command]
pub async fn get_settings() -> Result<Settings, String> {
    let file_path = get_settings_file_path()?;

    if !file_path.exists() {
        // Return default settings if file doesn't exist
        return Ok(Settings::default());
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    let settings: Settings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings file: {}", e))?;

    Ok(settings)
}

#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> {
    // Validate settings
    if settings.font_size < 10 || settings.font_size > 24 {
        return Err("Font size must be between 10 and 24".to_string());
    }

    let valid_themes = ["dark", "light", "monokai", "high-contrast"];
    if !valid_themes.contains(&settings.theme.as_str()) {
        return Err(format!(
            "Invalid theme: {}. Valid themes: dark, light, monokai, high-contrast",
            settings.theme
        ));
    }

    let valid_locales = ["en", "ko"];
    if !valid_locales.contains(&settings.locale.as_str()) {
        return Err(format!(
            "Invalid locale: {}. Valid locales: en, ko",
            settings.locale
        ));
    }

    let file_path = get_settings_file_path()?;

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&file_path, content).map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn log_session_output(session_id: String, data: String) -> Result<(), String> {
    // Check if logging is enabled
    let settings = get_settings().await?;
    if !settings.enable_logging {
        return Ok(());
    }

    let logs_dir = get_logs_dir_path()?;
    let log_file = logs_dir.join(format!("{}.log", session_id));

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to log file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_session_log(session_id: String) -> Result<String, String> {
    let logs_dir = get_logs_dir_path()?;
    let log_file = logs_dir.join(format!("{}.log", session_id));

    if !log_file.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(&log_file).map_err(|e| format!("Failed to read log file: {}", e))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionLogInfo {
    pub session_id: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub modified_at: Option<DateTime<Utc>>,
}

#[tauri::command]
pub async fn list_session_logs() -> Result<Vec<SessionLogInfo>, String> {
    let logs_dir = get_logs_dir_path()?;

    let mut logs = Vec::new();

    let entries =
        fs::read_dir(&logs_dir).map_err(|e| format!("Failed to read logs directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "log") {
            if let Ok(metadata) = entry.metadata() {
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                let session_id = path
                    .file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                let modified_at = metadata.modified().ok().map(|t| DateTime::<Utc>::from(t));

                logs.push(SessionLogInfo {
                    session_id,
                    file_name,
                    size_bytes: metadata.len(),
                    modified_at,
                });
            }
        }
    }

    // Sort by modified time (newest first)
    logs.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(logs)
}

#[tauri::command]
pub async fn delete_session_log(session_id: String) -> Result<(), String> {
    let logs_dir = get_logs_dir_path()?;
    let log_file = logs_dir.join(format!("{}.log", session_id));

    if !log_file.exists() {
        return Err(format!("Log file for session '{}' not found", session_id));
    }

    fs::remove_file(&log_file).map_err(|e| format!("Failed to delete log file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn clear_all_logs() -> Result<u32, String> {
    let logs_dir = get_logs_dir_path()?;

    let entries =
        fs::read_dir(&logs_dir).map_err(|e| format!("Failed to read logs directory: {}", e))?;

    let mut deleted_count = 0;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "log") {
            if fs::remove_file(&path).is_ok() {
                deleted_count += 1;
            }
        }
    }

    Ok(deleted_count)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub working_dir: Option<String>,
    pub project_id: Option<String>,
    pub pinned: bool,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabGroupInfo {
    pub id: String,
    pub name: String,
    pub color: String,
    pub collapsed: bool,
    pub tab_ids: Vec<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: 1200,
            height: 800,
            x: None,
            y: None,
            maximized: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionState {
    pub sessions: Vec<SessionInfo>,
    pub active_session_id: Option<String>,
    pub tab_groups: Vec<TabGroupInfo>,
    pub window_state: WindowState,
}

fn get_session_state_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or_else(|| "Failed to get data directory".to_string())?;
    let shellhive_dir = data_dir.join("shellhive");
    if !shellhive_dir.exists() {
        fs::create_dir_all(&shellhive_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    Ok(shellhive_dir.join("session-state.json"))
}

#[tauri::command]
pub async fn save_session_state(state: SessionState) -> Result<(), String> {
    let file_path = get_session_state_path()?;
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize session state: {}", e))?;
    fs::write(&file_path, content).map_err(|e| format!("Failed to write session state: {}", e))?;
    println!("[Settings] Session state saved");
    Ok(())
}

#[tauri::command]
pub async fn load_session_state() -> Result<SessionState, String> {
    let file_path = get_session_state_path()?;
    if !file_path.exists() {
        return Ok(SessionState::default());
    }
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read session state: {}", e))?;
    let state: SessionState = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse session state: {}", e))?;
    println!(
        "[Settings] Session state loaded: {} sessions",
        state.sessions.len()
    );
    Ok(state)
}
