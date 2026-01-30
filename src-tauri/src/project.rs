use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub shell: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[tauri::command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    // Phase 3에서 실제 구현
    Ok(vec![])
}

#[tauri::command]
pub async fn add_project(
    name: String,
    path: String,
    shell: Option<String>,
) -> Result<Project, String> {
    let project = Project {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        path,
        shell,
        created_at: Utc::now(),
    };
    // Phase 3에서 저장 구현
    Ok(project)
}

#[tauri::command]
pub async fn remove_project(_id: String) -> Result<(), String> {
    // Phase 3에서 실제 구현
    Ok(())
}

#[tauri::command]
pub async fn update_project(
    _id: String,
    _name: Option<String>,
    _path: Option<String>,
    _shell: Option<String>,
) -> Result<Project, String> {
    // Phase 3에서 실제 구현
    Err("Not implemented".to_string())
}
