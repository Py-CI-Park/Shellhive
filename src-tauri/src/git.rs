use serde::{Deserialize, Serialize};
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

fn run_git_command(path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Git command failed: {}", stderr))
    }
}

fn is_git_repo(path: &str) -> bool {
    Path::new(path).join(".git").exists()
        || run_git_command(path, &["rev-parse", "--git-dir"]).is_ok()
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, String> {
    if !is_git_repo(&path) {
        return Ok(GitStatus {
            branch: String::new(),
            files: vec![],
            ahead: 0,
            behind: 0,
            is_repo: false,
        });
    }

    // Get current branch
    let branch = run_git_command(&path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| String::from("unknown"));

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&path).unwrap_or((0, 0));

    // Get file status using porcelain v1 format
    let status_output = run_git_command(&path, &["status", "--porcelain"])?;

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
    let output = run_git_command(path, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])?;
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
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    let output = run_git_command(&path, &["branch", "-a", "--format=%(refname:short)|%(HEAD)"])?;

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
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    let limit_str = format!("-{}", limit);
    let output = run_git_command(
        &path,
        &[
            "log",
            &limit_str,
            "--format=%H|%s|%an|%ad",
            "--date=short",
        ],
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
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    if files.is_empty() {
        return Ok(());
    }

    let mut args = vec!["add"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git_command(&path, &args)?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    if files.is_empty() {
        return Ok(());
    }

    let mut args = vec!["reset", "HEAD", "--"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git_command(&path, &args)?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<(), String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    run_git_command(&path, &["commit", "-m", &message])?;
    Ok(())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<(), String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    run_git_command(&path, &["push"])?;
    Ok(())
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<(), String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    run_git_command(&path, &["pull"])?;
    Ok(())
}

#[tauri::command]
pub fn git_checkout(path: String, branch: String) -> Result<(), String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    run_git_command(&path, &["checkout", &branch])?;
    Ok(())
}

#[tauri::command]
pub fn git_discard(path: String, files: Vec<String>) -> Result<(), String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository".to_string());
    }

    if files.is_empty() {
        return Ok(());
    }

    let mut args = vec!["checkout", "--"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git_command(&path, &args)?;
    Ok(())
}
