use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub name: String,
    pub command: String,
    pub created_at: DateTime<Utc>,
}

/// Get snippets file path (APPDATA/shellhive/snippets.json)
fn get_snippets_file_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or_else(|| "Failed to get data directory".to_string())?;

    let shellhive_dir = data_dir.join("shellhive");

    // Create directory if it doesn't exist
    if !shellhive_dir.exists() {
        fs::create_dir_all(&shellhive_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    Ok(shellhive_dir.join("snippets.json"))
}

/// Load snippets from file
fn load_snippets() -> Result<Vec<Snippet>, String> {
    let file_path = get_snippets_file_path()?;

    // Return empty array if file doesn't exist
    if !file_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read snippets file: {}", e))?;

    let snippets: Vec<Snippet> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse snippets file: {}", e))?;

    Ok(snippets)
}

/// Save snippets to file
fn save_snippets(snippets: &[Snippet]) -> Result<(), String> {
    let file_path = get_snippets_file_path()?;

    let content = serde_json::to_string_pretty(snippets)
        .map_err(|e| format!("Failed to serialize snippets: {}", e))?;

    fs::write(&file_path, content).map_err(|e| format!("Failed to write snippets file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn list_snippets() -> Result<Vec<Snippet>, String> {
    load_snippets()
}

#[tauri::command]
pub async fn add_snippet(name: String, command: String) -> Result<Snippet, String> {
    // Validate inputs
    if name.trim().is_empty() {
        return Err("Snippet name cannot be empty".to_string());
    }
    if command.trim().is_empty() {
        return Err("Snippet command cannot be empty".to_string());
    }

    let mut snippets = load_snippets()?;

    // Check for duplicate name
    if snippets.iter().any(|s| s.name == name) {
        return Err(format!("Snippet with name '{}' already exists", name));
    }

    // Create new snippet
    let snippet = Snippet {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        command,
        created_at: Utc::now(),
    };

    snippets.push(snippet.clone());
    save_snippets(&snippets)?;

    Ok(snippet)
}

#[tauri::command]
pub async fn remove_snippet(id: String) -> Result<(), String> {
    let mut snippets = load_snippets()?;

    let initial_len = snippets.len();
    snippets.retain(|s| s.id != id);

    if snippets.len() == initial_len {
        return Err(format!("Snippet with id '{}' not found", id));
    }

    save_snippets(&snippets)?;
    Ok(())
}

#[tauri::command]
pub async fn get_snippet(id: String) -> Result<Snippet, String> {
    let snippets = load_snippets()?;

    snippets
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Snippet with id '{}' not found", id))
}

#[tauri::command]
pub async fn update_snippet(
    id: String,
    name: Option<String>,
    command: Option<String>,
) -> Result<Snippet, String> {
    let mut snippets = load_snippets()?;

    let snippet_idx = snippets
        .iter()
        .position(|s| s.id == id)
        .ok_or_else(|| format!("Snippet with id '{}' not found", id))?;

    // Check for duplicate name if name is being changed
    if let Some(ref new_name) = name {
        if snippets.iter().any(|s| s.id != id && s.name == *new_name) {
            return Err(format!("Snippet with name '{}' already exists", new_name));
        }
        snippets[snippet_idx].name = new_name.clone();
    }

    if let Some(new_command) = command {
        snippets[snippet_idx].command = new_command;
    }

    let updated_snippet = snippets[snippet_idx].clone();
    save_snippets(&snippets)?;

    Ok(updated_snippet)
}
