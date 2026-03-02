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

/// Claude Code 버전 정보 반환
#[tauri::command]
pub fn get_claude_version() -> Result<String, String> {
    get_claude_version_internal()
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

/// Claude 명령어 실행 (동기)
/// 간단한 명령어 실행용 (--help 등)
#[tauri::command]
pub fn execute_claude_command(args: Vec<String>) -> Result<String, String> {
    let mut cmd_args = vec!["/C".to_string(), "claude".to_string()];
    cmd_args.extend(args);

    let output = Command::new("cmd")
        .args(&cmd_args)
        .output()
        .map_err(|e| format!("Claude 명령어 실행 실패: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Claude 명령어 실패: {}", error))
    }
}

/// Claude 세션 시작을 위한 명령어 문자열 생성
/// PTY에서 직접 실행할 명령어 반환
#[tauri::command]
pub fn get_claude_start_command(project_path: Option<String>) -> String {
    match project_path {
        Some(path) => format!("cd /d \"{}\" && claude\r", path),
        None => "claude\r".to_string(),
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
    fn test_get_claude_start_command_with_path() {
        let cmd = get_claude_start_command(Some("C:\\Projects\\test".to_string()));
        assert!(cmd.contains("cd /d"));
        assert!(cmd.contains("claude"));
    }

    #[test]
    fn test_get_claude_start_command_without_path() {
        let cmd = get_claude_start_command(None);
        assert_eq!(cmd, "claude\r");
    }
}
