use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub shell: Option<String>,
    pub created_at: DateTime<Utc>,
    pub category_id: Option<String>,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectCategory {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub order: i32,
}

impl Default for ProjectCategory {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Default".to_string(),
            color: None,
            order: 0,
        }
    }
}

/// 설정 파일 경로 가져오기 (APPDATA/shellhive/projects.json)
fn get_projects_file_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or_else(|| "Failed to get data directory".to_string())?;

    let shellhive_dir = data_dir.join("shellhive");

    // 디렉토리가 없으면 생성
    if !shellhive_dir.exists() {
        fs::create_dir_all(&shellhive_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    Ok(shellhive_dir.join("projects.json"))
}

/// 프로젝트 목록 로드
fn load_projects() -> Result<Vec<Project>, String> {
    let file_path = get_projects_file_path()?;

    // 파일이 없으면 빈 배열 반환
    if !file_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read projects file: {}", e))?;

    let projects: Vec<Project> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse projects file: {}", e))?;

    Ok(projects)
}

/// 프로젝트 목록 저장
fn save_projects(projects: &[Project]) -> Result<(), String> {
    let file_path = get_projects_file_path()?;

    let content = serde_json::to_string_pretty(projects)
        .map_err(|e| format!("Failed to serialize projects: {}", e))?;

    fs::write(&file_path, content).map_err(|e| format!("Failed to write projects file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    load_projects()
}

#[tauri::command]
pub async fn add_project(
    name: String,
    path: String,
    shell: Option<String>,
) -> Result<Project, String> {
    // 경로 유효성 검증
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // 기존 프로젝트 목록 로드
    let mut projects = load_projects()?;

    // 중복 체크 (같은 경로가 이미 존재하는지)
    if projects.iter().any(|p| p.path == path) {
        return Err(format!("Project with path '{}' already exists", path));
    }

    // 새 프로젝트 생성
    let project = Project {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        path,
        shell,
        created_at: Utc::now(),
        category_id: None,
        env_vars: HashMap::new(),
    };

    // 프로젝트 추가 및 저장
    projects.push(project.clone());
    save_projects(&projects)?;

    Ok(project)
}

#[tauri::command]
pub async fn remove_project(id: String) -> Result<(), String> {
    let mut projects = load_projects()?;

    // ID로 프로젝트 찾기
    let initial_len = projects.len();
    projects.retain(|p| p.id != id);

    // 프로젝트를 찾지 못한 경우
    if projects.len() == initial_len {
        return Err(format!("Project with id '{}' not found", id));
    }

    save_projects(&projects)?;
    Ok(())
}

#[tauri::command]
pub async fn update_project(
    id: String,
    name: Option<String>,
    path: Option<String>,
    shell: Option<String>,
) -> Result<Project, String> {
    let mut projects = load_projects()?;

    // ID로 프로젝트 인덱스 찾기
    let project_idx = projects
        .iter()
        .position(|p| p.id == id)
        .ok_or_else(|| format!("Project with id '{}' not found", id))?;

    // 경로가 변경되는 경우 유효성 검증
    if let Some(ref new_path) = path {
        let path_buf = PathBuf::from(new_path);
        if !path_buf.exists() {
            return Err(format!("Path does not exist: {}", new_path));
        }
        if !path_buf.is_dir() {
            return Err(format!("Path is not a directory: {}", new_path));
        }

        // 중복 체크 (다른 프로젝트가 같은 경로를 사용하는지)
        if projects.iter().any(|p| p.id != id && p.path == *new_path) {
            return Err(format!(
                "Another project with path '{}' already exists",
                new_path
            ));
        }

        projects[project_idx].path = new_path.clone();
    }

    // 필드 업데이트
    if let Some(new_name) = name {
        projects[project_idx].name = new_name;
    }

    if let Some(new_shell) = shell {
        projects[project_idx].shell = Some(new_shell);
    }

    let updated_project = projects[project_idx].clone();

    save_projects(&projects)?;
    Ok(updated_project)
}

/// 카테고리 파일 경로 가져오기
fn get_categories_file_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or_else(|| "Failed to get data directory".to_string())?;
    let shellhive_dir = data_dir.join("shellhive");
    if !shellhive_dir.exists() {
        std::fs::create_dir_all(&shellhive_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    Ok(shellhive_dir.join("categories.json"))
}

#[tauri::command]
pub async fn list_categories() -> Result<Vec<ProjectCategory>, String> {
    let file_path = get_categories_file_path()?;
    if !file_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read categories: {}", e))?;
    let categories: Vec<ProjectCategory> =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse categories: {}", e))?;
    Ok(categories)
}

#[tauri::command]
pub async fn add_category(name: String, color: Option<String>) -> Result<ProjectCategory, String> {
    let mut categories = list_categories().await?;

    let order = categories.len() as i32;
    let category = ProjectCategory {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        color,
        order,
    };

    categories.push(category.clone());
    save_categories(&categories)?;

    Ok(category)
}

#[tauri::command]
pub async fn remove_category(id: String) -> Result<(), String> {
    let mut categories = list_categories().await?;
    categories.retain(|c| c.id != id);
    save_categories(&categories)?;

    // Also update projects to remove the category reference
    let mut projects = list_projects().await?;
    for project in &mut projects {
        if project.category_id.as_ref() == Some(&id) {
            project.category_id = None;
        }
    }
    save_projects(&projects)?;

    Ok(())
}

#[tauri::command]
pub async fn update_category(
    id: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let mut categories = list_categories().await?;

    if let Some(cat) = categories.iter_mut().find(|c| c.id == id) {
        if let Some(n) = name {
            cat.name = n;
        }
        if let Some(c) = color {
            cat.color = Some(c);
        }
    }

    save_categories(&categories)?;
    Ok(())
}

#[tauri::command]
pub async fn set_project_category(
    project_id: String,
    category_id: Option<String>,
) -> Result<(), String> {
    let mut projects = list_projects().await?;

    if let Some(project) = projects.iter_mut().find(|p| p.id == project_id) {
        project.category_id = category_id;
    }

    save_projects(&projects)?;
    Ok(())
}

fn save_categories(categories: &[ProjectCategory]) -> Result<(), String> {
    let file_path = get_categories_file_path()?;
    let content = serde_json::to_string_pretty(categories)
        .map_err(|e| format!("Failed to serialize categories: {}", e))?;
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write categories: {}", e))?;
    Ok(())
}

/// Load environment variables from .shellhive.env file in project directory
#[tauri::command]
pub async fn load_project_env(project_path: String) -> Result<HashMap<String, String>, String> {
    let env_file = PathBuf::from(&project_path).join(".shellhive.env");
    let mut env_vars = HashMap::new();

    if !env_file.exists() {
        return Ok(env_vars);
    }

    let content = fs::read_to_string(&env_file)
        .map_err(|e| format!("Failed to read .shellhive.env: {}", e))?;

    for line in content.lines() {
        let line = line.trim();

        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Parse KEY=value format
        if let Some(pos) = line.find('=') {
            let key = line[..pos].trim().to_string();
            let value = line[pos + 1..].trim().to_string();

            // Remove surrounding quotes if present
            let value = if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value[1..value.len() - 1].to_string()
            } else {
                value
            };

            if !key.is_empty() {
                env_vars.insert(key, value);
            }
        }
    }

    Ok(env_vars)
}

/// Save environment variables to .shellhive.env file in project directory
#[tauri::command]
pub async fn save_project_env(
    project_path: String,
    env_vars: HashMap<String, String>,
) -> Result<(), String> {
    let env_file = PathBuf::from(&project_path).join(".shellhive.env");

    let mut content = String::from("# Shellhive Project Environment Variables\n");
    content.push_str("# Format: KEY=value\n\n");

    // Sort keys for consistent output
    let mut keys: Vec<_> = env_vars.keys().collect();
    keys.sort();

    for key in keys {
        if let Some(value) = env_vars.get(key) {
            // Quote values that contain spaces or special characters
            let formatted_value = if value.contains(' ')
                || value.contains('=')
                || value.contains('#')
                || value.contains('"')
            {
                format!("\"{}\"", value.replace('\"', "\\\""))
            } else {
                value.clone()
            };
            content.push_str(&format!("{}={}\n", key, formatted_value));
        }
    }

    fs::write(&env_file, content).map_err(|e| format!("Failed to write .shellhive.env: {}", e))?;

    Ok(())
}

/// Get environment variables for a project (from .shellhive.env file)
#[tauri::command]
pub async fn get_project_env_vars(project_id: String) -> Result<HashMap<String, String>, String> {
    let projects = load_projects()?;

    let project = projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project with id '{}' not found", project_id))?;

    load_project_env(project.path.clone()).await
}

/// Update environment variables for a project
#[tauri::command]
pub async fn update_project_env_vars(
    project_id: String,
    env_vars: HashMap<String, String>,
) -> Result<(), String> {
    let projects = load_projects()?;

    let project = projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project with id '{}' not found", project_id))?;

    save_project_env(project.path.clone(), env_vars).await
}
