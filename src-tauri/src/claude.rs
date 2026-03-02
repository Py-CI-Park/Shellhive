// Claude Code CLI 통합 모듈
// Claude Code CLI 설치 여부 확인, 버전 정보, 명령어 실행 기능 제공

use serde::{Deserialize, Serialize};
use std::process::Command;

/// Claude Code 상태 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

/// Claude Code CLI 설치 여부 확인
/// Windows에서 `where claude` 명령어로 설치 경로 확인
#[tauri::command]
pub fn check_claude_installed() -> Result<ClaudeStatus, String> {
    // Windows에서 claude 명령어 경로 찾기
    let output = Command::new("cmd")
        .args(["/C", "where", "claude"])
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();

                // 버전 정보도 함께 가져오기
                let version = get_claude_version_internal().ok();

                Ok(ClaudeStatus {
                    installed: true,
                    version,
                    path: Some(path),
                })
            } else {
                Ok(ClaudeStatus {
                    installed: false,
                    version: None,
                    path: None,
                })
            }
        }
        Err(e) => Err(format!("Claude 설치 확인 실패: {}", e)),
    }
}

/// 내부용 버전 확인 함수
fn get_claude_version_internal() -> Result<String, String> {
    let output = Command::new("cmd")
        .args(["/C", "claude", "--version"])
        .output()
        .map_err(|e| format!("버전 확인 실패: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(version)
    } else {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("버전 확인 실패: {}", error))
    }
}

fn sanitize_project_path_for_cmd(path: &str) -> Result<String, String> {
    let canonical_path = crate::project::ensure_registered_project_path_or_subdir(path)?;
    let canonical_str = canonical_path.to_string_lossy().to_string();

    if canonical_str.contains('\"') || canonical_str.contains('\n') || canonical_str.contains('\r') {
        return Err("Invalid project path for command execution".to_string());
    }

    Ok(canonical_str)
}

/// Claude 세션 시작을 위한 명령어 문자열 생성
/// PTY에서 직접 실행할 명령어 반환
#[tauri::command]
pub fn get_claude_start_command(project_path: Option<String>) -> Result<String, String> {
    match project_path {
        Some(path) => {
            let safe_path = sanitize_project_path_for_cmd(&path)?;
            Ok(format!("cd /d \"{}\" && claude\r", safe_path))
        }
        None => Ok("claude\r".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_status_serialization() {
        let status = ClaudeStatus {
            installed: true,
            version: Some("1.0.0".to_string()),
            path: Some("C:\\path\\to\\claude.exe".to_string()),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("installed"));
        assert!(json.contains("version"));
    }

    #[test]
    fn test_get_claude_start_command_returns_claude_without_path() {
        let cmd = get_claude_start_command(None).unwrap();
        assert_eq!(cmd, "claude\r");
    }

    #[test]
    fn test_get_claude_start_command_path_with_quotes_rejected() {
        let result = sanitize_project_path_for_cmd("C:\\bad\"path");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_claude_start_command_path_with_ampersand_rejected() {
        let result = sanitize_project_path_for_cmd("C:\\temp&&whoami");
        assert!(result.is_err());
    }
}
