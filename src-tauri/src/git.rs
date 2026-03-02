use crate::project::ensure_registered_project_path;
use serde::{Deserialize, Serialize};
use std::path::Component;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub files: Vec<FileStatus>,
    pub ahead: u32,
    pub behind: u32,
    pub is_repo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStatus {
    pub path: String,
    pub status: String, // "M" = Modified, "A" = Added, "D" = Deleted, "?" = Untracked, "R" = Renamed
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

fn resolve_registered_path(path: &str) -> Result<String, String> {
    let canonical = ensure_registered_project_path(path)?;
    Ok(canonical.to_string_lossy().into_owned())
}

fn run_git_command(path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout).map_err(|e| format!("Invalid UTF-8 output: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Git command failed: {}", stderr))
    }
}

fn is_git_repo(path: &str) -> bool {
    Path::new(path).join(".git").exists()
        || run_git_command(path, &["rev-parse", "--git-dir"]).is_ok()
}

fn ensure_git_repo(path: &str) -> Result<String, String> {
    let validated_path = resolve_registered_path(path)?;
    if !is_git_repo(&validated_path) {
        return Err("Not a git repository".to_string());
    }
    Ok(validated_path)
}

fn validate_branch_name(path: &str, branch: &str) -> Result<String, String> {
    let trimmed = branch.trim();

    if trimmed.is_empty() {
        return Err("Branch name cannot be empty".to_string());
    }

    if trimmed.starts_with('-')
        || trimmed.contains('\0')
        || trimmed.contains('\n')
        || trimmed.contains('\r')
    {
        return Err("Invalid branch name format".to_string());
    }

    run_git_command(path, &["check-ref-format", "--branch", trimmed])
        .map_err(|_| format!("Invalid branch name: {}", branch))?;

    Ok(trimmed.to_string())
}

fn validate_git_file_path(repo_path: &str, file: &str) -> Result<String, String> {
    let trimmed = file.trim();
    if trimmed.is_empty() {
        return Err("File path cannot be empty".to_string());
    }
    if trimmed.contains('\0') || trimmed.contains('\n') || trimmed.contains('\r') {
        return Err(format!("Invalid file path: {}", file));
    }
    if trimmed.starts_with('-') {
        return Err(format!("File path cannot start with '-': {}", file));
    }

    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err(format!("Absolute paths are not allowed: {}", file));
    }

    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir | Component::RootDir))
    {
        return Err(format!("Path traversal is not allowed: {}", file));
    }

    let repo_canonical = std::fs::canonicalize(repo_path).map_err(|e| {
        format!(
            "Failed to canonicalize repository path '{}': {}",
            repo_path, e
        )
    })?;
    let candidate = repo_canonical.join(path);

    if candidate.exists() {
        let file_canonical = std::fs::canonicalize(&candidate).map_err(|e| {
            format!(
                "Failed to canonicalize file path '{}': {}",
                candidate.display(),
                e
            )
        })?;
        if !file_canonical.starts_with(&repo_canonical) {
            return Err(format!("File path is outside repository root: {}", file));
        }
    }

    Ok(trimmed.to_string())
}

fn validate_git_file_paths(repo_path: &str, files: &[String]) -> Result<Vec<String>, String> {
    files
        .iter()
        .map(|file| validate_git_file_path(repo_path, file))
        .collect()
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, String> {
    let validated_path = resolve_registered_path(&path)?;

    if !is_git_repo(&validated_path) {
        return Ok(GitStatus {
            branch: String::new(),
            files: vec![],
            ahead: 0,
            behind: 0,
            is_repo: false,
        });
    }

    // Get current branch
    let branch = run_git_command(&validated_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| String::from("unknown"));

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&validated_path).unwrap_or((0, 0));

    // Get file status using porcelain v1 format
    let status_output = run_git_command(&validated_path, &["status", "--porcelain"])?;

    let files: Vec<FileStatus> = status_output
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            let chars: Vec<char> = line.chars().collect();
            let index_status = chars.first().copied().unwrap_or(' ');
            let worktree_status = chars.get(1).copied().unwrap_or(' ');
            let file_path = line[3..].to_string();

            // Determine the display status
            let status = if index_status == '?' {
                "?".to_string()
            } else if index_status == 'A' || worktree_status == 'A' {
                "A".to_string()
            } else if index_status == 'D' || worktree_status == 'D' {
                "D".to_string()
            } else if index_status == 'R' || worktree_status == 'R' {
                "R".to_string()
            } else if index_status == 'M' || worktree_status == 'M' {
                "M".to_string()
            } else {
                worktree_status.to_string()
            };

            let staged = index_status != ' ' && index_status != '?';

            FileStatus {
                path: file_path,
                status,
                staged,
            }
        })
        .collect();

    Ok(GitStatus {
        branch,
        files,
        ahead,
        behind,
        is_repo: true,
    })
}

fn get_ahead_behind(path: &str) -> Result<(u32, u32), String> {
    let output = run_git_command(
        path,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )?;
    let parts: Vec<&str> = output.trim().split('\t').collect();

    if parts.len() == 2 {
        let ahead = parts[0].parse().unwrap_or(0);
        let behind = parts[1].parse().unwrap_or(0);
        Ok((ahead, behind))
    } else {
        Ok((0, 0))
    }
}

#[tauri::command]
pub fn git_branches(path: String) -> Result<Vec<Branch>, String> {
    let validated_path = ensure_git_repo(&path)?;

    let output = run_git_command(
        &validated_path,
        &["branch", "-a", "--format=%(refname:short)|%(HEAD)"],
    )?;

    let branches: Vec<Branch> = output
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            let name = parts.first().unwrap_or(&"").to_string();
            let is_current = parts.get(1).map(|s| *s == "*").unwrap_or(false);
            let is_remote = name.starts_with("remotes/") || name.starts_with("origin/");

            Branch {
                name: name.replace("remotes/", ""),
                is_current,
                is_remote,
            }
        })
        .collect();

    Ok(branches)
}

#[tauri::command]
pub fn git_log(path: String, limit: u32) -> Result<Vec<Commit>, String> {
    let validated_path = ensure_git_repo(&path)?;

    let limit_str = format!("-{}", limit);
    let output = run_git_command(
        &validated_path,
        &["log", &limit_str, "--format=%H|%s|%an|%ad", "--date=short"],
    )?;

    let commits: Vec<Commit> = output
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(4, '|').collect();
            if parts.len() >= 4 {
                Some(Commit {
                    hash: parts[0][..7.min(parts[0].len())].to_string(), // Short hash
                    message: parts[1].to_string(),
                    author: parts[2].to_string(),
                    date: parts[3].to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(commits)
}

#[tauri::command]
pub fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    let validated_path = ensure_git_repo(&path)?;

    if files.is_empty() {
        return Ok(());
    }

    let validated_files = validate_git_file_paths(&validated_path, &files)?;

    let mut args = vec!["add", "--"];
    let file_refs: Vec<&str> = validated_files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git_command(&validated_path, &args)?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    let validated_path = ensure_git_repo(&path)?;

    if files.is_empty() {
        return Ok(());
    }

    let validated_files = validate_git_file_paths(&validated_path, &files)?;

    let mut args = vec!["reset", "HEAD", "--"];
    let file_refs: Vec<&str> = validated_files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git_command(&validated_path, &args)?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<(), String> {
    let validated_path = ensure_git_repo(&path)?;

    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    run_git_command(&validated_path, &["commit", "-m", &message])?;
    Ok(())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<(), String> {
    let validated_path = ensure_git_repo(&path)?;

    run_git_command(&validated_path, &["push"])?;
    Ok(())
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<(), String> {
    let validated_path = ensure_git_repo(&path)?;

    run_git_command(&validated_path, &["pull"])?;
    Ok(())
}

#[tauri::command]
pub fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let validated_path = ensure_git_repo(&path)?;
    let safe_branch = validate_branch_name(&validated_path, &branch)?;

    run_git_command(&validated_path, &["checkout", &safe_branch])?;
    Ok(())
}

#[tauri::command]
pub fn git_discard(path: String, files: Vec<String>) -> Result<(), String> {
    let validated_path = ensure_git_repo(&path)?;

    if files.is_empty() {
        return Ok(());
    }

    let validated_files = validate_git_file_paths(&validated_path, &files)?;

    let mut args = vec!["checkout", "--"];
    let file_refs: Vec<&str> = validated_files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git_command(&validated_path, &args)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_temp_dir(prefix: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("{}_{}", prefix, uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("failed to create temp directory");
        dir
    }

    #[test]
    fn test_validate_git_file_path_allowed() {
        let repo = create_temp_dir("shellhive_git_repo");
        let file = repo.join("src").join("main.rs");
        fs::create_dir_all(file.parent().expect("parent should exist"))
            .expect("failed to create parent directory");
        fs::write(&file, "fn main() {}").expect("failed to write test file");

        let result = validate_git_file_path(
            repo.to_str().expect("repo path should be valid UTF-8"),
            "src/main.rs",
        );
        assert_eq!(result.unwrap(), "src/main.rs");

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn test_validate_git_file_path_rejects_absolute_path() {
        let repo = create_temp_dir("shellhive_git_repo_abs");
        let absolute = std::env::temp_dir()
            .join("outside.txt")
            .to_string_lossy()
            .to_string();

        let result = validate_git_file_path(
            repo.to_str().expect("repo path should be valid UTF-8"),
            &absolute,
        );
        assert!(result.is_err());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn test_validate_git_file_path_rejects_traversal() {
        let repo = create_temp_dir("shellhive_git_repo_traversal");
        let result = validate_git_file_path(
            repo.to_str().expect("repo path should be valid UTF-8"),
            "../outside.txt",
        );
        assert!(result.is_err());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn test_validate_git_file_path_rejects_option_like_input() {
        let repo = create_temp_dir("shellhive_git_repo_option");
        let result = validate_git_file_path(
            repo.to_str().expect("repo path should be valid UTF-8"),
            "--all",
        );
        assert!(result.is_err());

        let _ = fs::remove_dir_all(repo);
    }
}
