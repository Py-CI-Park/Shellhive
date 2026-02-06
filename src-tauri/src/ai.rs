// AI 자연어 명령어 변환 모듈
// 사용자의 자연어 입력을 쉘 명령어로 변환

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// AI 변환 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResult {
    pub success: bool,
    pub command: Option<String>,
    pub description: Option<String>,
    pub confidence: f32,
    pub alternatives: Vec<String>,
}

/// 쉘 타입
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum ShellType {
    #[default]
    PowerShell,
    Cmd,
    Bash,
    Zsh,
}

/// 로컬 패턴 매칭을 위한 패턴 정의
struct PatternRule {
    keywords: Vec<&'static str>,
    pattern: fn(&str, &ShellType) -> Option<String>,
    description: &'static str,
}

/// 자연어를 명령어로 변환 (로컬 패턴 매칭)
#[tauri::command]
pub fn translate_natural_language(
    text: String,
    shell_type: Option<String>,
) -> Result<TranslationResult, String> {
    let shell = match shell_type.as_deref() {
        Some("powershell") | Some("pwsh") => ShellType::PowerShell,
        Some("cmd") => ShellType::Cmd,
        Some("bash") => ShellType::Bash,
        Some("zsh") => ShellType::Zsh,
        _ => ShellType::PowerShell, // Windows 기본
    };

    let text_lower = text.to_lowercase();

    // 패턴 규칙 정의
    let rules = get_pattern_rules();

    for rule in &rules {
        if rule.keywords.iter().any(|k| text_lower.contains(k)) {
            if let Some(command) = (rule.pattern)(&text, &shell) {
                return Ok(TranslationResult {
                    success: true,
                    command: Some(command),
                    description: Some(rule.description.to_string()),
                    confidence: 0.8,
                    alternatives: vec![],
                });
            }
        }
    }

    // 패턴 매칭 실패 시 기본 응답
    Ok(TranslationResult {
        success: false,
        command: None,
        description: Some("변환할 수 없는 명령입니다. 더 구체적으로 입력해 주세요.".to_string()),
        confidence: 0.0,
        alternatives: get_suggestions(&text_lower),
    })
}

/// 패턴 규칙 목록 반환
fn get_pattern_rules() -> Vec<PatternRule> {
    vec![
        // 파일 찾기
        PatternRule {
            keywords: vec!["파일 찾", "파일을 찾", "find file", "search file", "파일 검색"],
            pattern: |text, shell| {
                let ext = extract_extension(text);
                let name = extract_filename(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(ext) = ext {
                            Some(format!("Get-ChildItem -Recurse -Filter \"*.{}\"", ext))
                        } else if let Some(name) = name {
                            Some(format!("Get-ChildItem -Recurse -Filter \"*{}*\"", name))
                        } else {
                            Some("Get-ChildItem -Recurse".to_string())
                        }
                    }
                    ShellType::Cmd => {
                        if let Some(ext) = ext {
                            Some(format!("dir /s /b *.{}", ext))
                        } else if let Some(name) = name {
                            Some(format!("dir /s /b *{}*", name))
                        } else {
                            Some("dir /s /b".to_string())
                        }
                    }
                    _ => {
                        if let Some(ext) = ext {
                            Some(format!("find . -name \"*.{}\"", ext))
                        } else if let Some(name) = name {
                            Some(format!("find . -name \"*{}*\"", name))
                        } else {
                            Some("find . -type f".to_string())
                        }
                    }
                }
            },
            description: "파일 검색",
        },
        // 폴더 만들기
        PatternRule {
            keywords: vec!["폴더 만들", "폴더를 만들", "폴더 생성", "디렉토리 만들", "mkdir", "create folder", "create directory"],
            pattern: |text, shell| {
                let name = extract_folder_name(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(name) = name {
                            Some(format!("New-Item -ItemType Directory -Name \"{}\"", name))
                        } else {
                            Some("New-Item -ItemType Directory -Name \"new_folder\"".to_string())
                        }
                    }
                    _ => {
                        if let Some(name) = name {
                            Some(format!("mkdir \"{}\"", name))
                        } else {
                            Some("mkdir new_folder".to_string())
                        }
                    }
                }
            },
            description: "폴더 생성",
        },
        // 파일 삭제
        PatternRule {
            keywords: vec!["파일 삭제", "파일을 삭제", "파일 지우", "delete file", "remove file", "rm "],
            pattern: |text, shell| {
                let name = extract_filename(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(name) = name {
                            Some(format!("Remove-Item \"{}\" -Confirm", name))
                        } else {
                            Some("Remove-Item \"filename\" -Confirm".to_string())
                        }
                    }
                    ShellType::Cmd => {
                        if let Some(name) = name {
                            Some(format!("del /p \"{}\"", name))
                        } else {
                            Some("del /p filename".to_string())
                        }
                    }
                    _ => {
                        if let Some(name) = name {
                            Some(format!("rm -i \"{}\"", name))
                        } else {
                            Some("rm -i filename".to_string())
                        }
                    }
                }
            },
            description: "파일 삭제",
        },
        // 큰 파일 찾기
        PatternRule {
            keywords: vec!["큰 파일", "대용량 파일", "large file", "big file", "용량 큰"],
            pattern: |text, shell| {
                let count = extract_number(text).unwrap_or(10);
                match shell {
                    ShellType::PowerShell => {
                        Some(format!(
                            "Get-ChildItem -Recurse -File | Sort-Object Length -Descending | Select-Object -First {} | Format-Table Name, @{{n='Size(MB)';e={{[math]::Round($_.Length/1MB,2)}}}}",
                            count
                        ))
                    }
                    ShellType::Cmd => {
                        Some("forfiles /S /C \"cmd /c if @fsize GEQ 1048576 echo @path @fsize\"".to_string())
                    }
                    _ => {
                        Some(format!(
                            "find . -type f -exec ls -lh {{}} + 2>/dev/null | sort -k5 -rh | head -{}",
                            count
                        ))
                    }
                }
            },
            description: "대용량 파일 검색",
        },
        // 현재 디렉토리 내용
        PatternRule {
            keywords: vec!["현재 폴더", "폴더 내용", "파일 목록", "디렉토리 보", "list files", "show files", "ls", "dir"],
            pattern: |_text, shell| {
                match shell {
                    ShellType::PowerShell => Some("Get-ChildItem".to_string()),
                    ShellType::Cmd => Some("dir".to_string()),
                    _ => Some("ls -la".to_string()),
                }
            },
            description: "현재 디렉토리 파일 목록",
        },
        // Git 상태
        PatternRule {
            keywords: vec!["git 상태", "git status", "깃 상태", "변경사항", "changes"],
            pattern: |_text, _shell| Some("git status".to_string()),
            description: "Git 상태 확인",
        },
        // Git 커밋
        PatternRule {
            keywords: vec!["git 커밋", "git commit", "깃 커밋", "커밋하"],
            pattern: |text, _shell| {
                let message = extract_quoted_text(text);
                if let Some(msg) = message {
                    Some(format!("git commit -m \"{}\"", msg))
                } else {
                    Some("git commit -m \"\"".to_string())
                }
            },
            description: "Git 커밋",
        },
        // Git 푸시
        PatternRule {
            keywords: vec!["git 푸시", "git push", "깃 푸시", "푸시하"],
            pattern: |_text, _shell| Some("git push".to_string()),
            description: "Git 푸시",
        },
        // Git 풀
        PatternRule {
            keywords: vec!["git 풀", "git pull", "깃 풀", "풀 받", "당겨"],
            pattern: |_text, _shell| Some("git pull".to_string()),
            description: "Git 풀",
        },
        // 프로세스 확인
        PatternRule {
            keywords: vec!["프로세스", "실행 중", "process", "running"],
            pattern: |text, shell| {
                let name = extract_process_name(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(name) = name {
                            Some(format!("Get-Process | Where-Object {{$_.Name -like '*{}*'}}", name))
                        } else {
                            Some("Get-Process".to_string())
                        }
                    }
                    ShellType::Cmd => {
                        if let Some(name) = name {
                            Some(format!("tasklist | findstr /i \"{}\"", name))
                        } else {
                            Some("tasklist".to_string())
                        }
                    }
                    _ => {
                        if let Some(name) = name {
                            Some(format!("ps aux | grep -i \"{}\"", name))
                        } else {
                            Some("ps aux".to_string())
                        }
                    }
                }
            },
            description: "프로세스 확인",
        },
        // 포트 확인
        PatternRule {
            keywords: vec!["포트", "port", "네트워크", "network", "연결"],
            pattern: |text, shell| {
                let port = extract_number(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(p) = port {
                            Some(format!("Get-NetTCPConnection -LocalPort {} -ErrorAction SilentlyContinue", p))
                        } else {
                            Some("Get-NetTCPConnection | Select-Object LocalPort, RemoteAddress, State".to_string())
                        }
                    }
                    ShellType::Cmd => {
                        if let Some(p) = port {
                            Some(format!("netstat -ano | findstr \"{}\"", p))
                        } else {
                            Some("netstat -ano".to_string())
                        }
                    }
                    _ => {
                        if let Some(p) = port {
                            Some(format!("lsof -i :{}", p))
                        } else {
                            Some("netstat -tuln".to_string())
                        }
                    }
                }
            },
            description: "네트워크 포트 확인",
        },
        // 파일 내용 보기
        PatternRule {
            keywords: vec!["파일 내용", "파일 보", "내용 보", "cat ", "type ", "읽어"],
            pattern: |text, shell| {
                let name = extract_filename(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(name) = name {
                            Some(format!("Get-Content \"{}\"", name))
                        } else {
                            Some("Get-Content filename".to_string())
                        }
                    }
                    ShellType::Cmd => {
                        if let Some(name) = name {
                            Some(format!("type \"{}\"", name))
                        } else {
                            Some("type filename".to_string())
                        }
                    }
                    _ => {
                        if let Some(name) = name {
                            Some(format!("cat \"{}\"", name))
                        } else {
                            Some("cat filename".to_string())
                        }
                    }
                }
            },
            description: "파일 내용 보기",
        },
        // 파일 복사
        PatternRule {
            keywords: vec!["파일 복사", "복사하", "copy ", "cp "],
            pattern: |_text, shell| {
                match shell {
                    ShellType::PowerShell => Some("Copy-Item \"source\" -Destination \"dest\"".to_string()),
                    ShellType::Cmd => Some("copy source dest".to_string()),
                    _ => Some("cp source dest".to_string()),
                }
            },
            description: "파일 복사",
        },
        // 파일 이동
        PatternRule {
            keywords: vec!["파일 이동", "이동하", "move ", "mv "],
            pattern: |_text, shell| {
                match shell {
                    ShellType::PowerShell => Some("Move-Item \"source\" -Destination \"dest\"".to_string()),
                    ShellType::Cmd => Some("move source dest".to_string()),
                    _ => Some("mv source dest".to_string()),
                }
            },
            description: "파일 이동",
        },
        // 디스크 용량
        PatternRule {
            keywords: vec!["디스크 용량", "디스크 공간", "저장 공간", "disk space", "storage"],
            pattern: |_text, shell| {
                match shell {
                    ShellType::PowerShell => Some("Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{n='Used(GB)';e={[math]::Round($_.Used/1GB,2)}}, @{n='Free(GB)';e={[math]::Round($_.Free/1GB,2)}}".to_string()),
                    ShellType::Cmd => Some("wmic logicaldisk get size,freespace,caption".to_string()),
                    _ => Some("df -h".to_string()),
                }
            },
            description: "디스크 용량 확인",
        },
        // 시스템 정보
        PatternRule {
            keywords: vec!["시스템 정보", "컴퓨터 정보", "system info", "sysinfo"],
            pattern: |_text, shell| {
                match shell {
                    ShellType::PowerShell => Some("Get-ComputerInfo | Select-Object WindowsProductName, OsVersion, CsProcessors, CsTotalPhysicalMemory".to_string()),
                    ShellType::Cmd => Some("systeminfo".to_string()),
                    _ => Some("uname -a && cat /etc/os-release".to_string()),
                }
            },
            description: "시스템 정보 확인",
        },
        // npm 설치
        PatternRule {
            keywords: vec!["npm 설치", "npm install", "패키지 설치", "install package"],
            pattern: |text, _shell| {
                let pkg = extract_package_name(text);
                if let Some(pkg) = pkg {
                    Some(format!("npm install {}", pkg))
                } else {
                    Some("npm install".to_string())
                }
            },
            description: "npm 패키지 설치",
        },
        // 환경 변수
        PatternRule {
            keywords: vec!["환경 변수", "environment", "env"],
            pattern: |text, shell| {
                let var_name = extract_env_var_name(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(name) = var_name {
                            Some(format!("$env:{}", name))
                        } else {
                            Some("Get-ChildItem Env:".to_string())
                        }
                    }
                    ShellType::Cmd => {
                        if let Some(name) = var_name {
                            Some(format!("echo %{}%", name))
                        } else {
                            Some("set".to_string())
                        }
                    }
                    _ => {
                        if let Some(name) = var_name {
                            Some(format!("echo ${}", name))
                        } else {
                            Some("printenv".to_string())
                        }
                    }
                }
            },
            description: "환경 변수 확인",
        },
        // 텍스트 검색
        PatternRule {
            keywords: vec!["텍스트 검색", "문자열 검색", "grep ", "search text", "찾아줘"],
            pattern: |text, shell| {
                let search_term = extract_quoted_text(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(term) = search_term {
                            Some(format!("Get-ChildItem -Recurse | Select-String -Pattern \"{}\"", term))
                        } else {
                            Some("Get-ChildItem -Recurse | Select-String -Pattern \"search_term\"".to_string())
                        }
                    }
                    ShellType::Cmd => {
                        if let Some(term) = search_term {
                            Some(format!("findstr /s /i \"{}\" *.*", term))
                        } else {
                            Some("findstr /s /i \"search_term\" *.*".to_string())
                        }
                    }
                    _ => {
                        if let Some(term) = search_term {
                            Some(format!("grep -r \"{}\" .", term))
                        } else {
                            Some("grep -r \"search_term\" .".to_string())
                        }
                    }
                }
            },
            description: "파일 내 텍스트 검색",
        },
        // 압축
        PatternRule {
            keywords: vec!["압축", "zip", "compress", "archive"],
            pattern: |text, shell| {
                let name = extract_filename(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(name) = name {
                            Some(format!("Compress-Archive -Path \"{}\" -DestinationPath \"{}.zip\"", name, name))
                        } else {
                            Some("Compress-Archive -Path \"folder\" -DestinationPath \"archive.zip\"".to_string())
                        }
                    }
                    _ => {
                        if let Some(name) = name {
                            Some(format!("zip -r {}.zip {}", name, name))
                        } else {
                            Some("zip -r archive.zip folder".to_string())
                        }
                    }
                }
            },
            description: "파일/폴더 압축",
        },
        // 압축 해제
        PatternRule {
            keywords: vec!["압축 해제", "unzip", "extract", "압축 풀"],
            pattern: |text, shell| {
                let name = extract_filename(text);
                match shell {
                    ShellType::PowerShell => {
                        if let Some(name) = name {
                            Some(format!("Expand-Archive -Path \"{}\" -DestinationPath \".\"", name))
                        } else {
                            Some("Expand-Archive -Path \"archive.zip\" -DestinationPath \".\"".to_string())
                        }
                    }
                    _ => {
                        if let Some(name) = name {
                            Some(format!("unzip {}", name))
                        } else {
                            Some("unzip archive.zip".to_string())
                        }
                    }
                }
            },
            description: "압축 해제",
        },
    ]
}

/// 사용 가능한 명령어 제안
fn get_suggestions(text: &str) -> Vec<String> {
    let mut suggestions = vec![];

    if text.contains("파일") || text.contains("file") {
        suggestions.push("파일 찾기: \"js 파일 찾아줘\"".to_string());
        suggestions.push("파일 삭제: \"test.txt 파일 삭제해줘\"".to_string());
        suggestions.push("파일 내용: \"readme.md 파일 내용 보여줘\"".to_string());
    }

    if text.contains("git") || text.contains("깃") {
        suggestions.push("Git 상태: \"git 상태 보여줘\"".to_string());
        suggestions.push("Git 커밋: \"'메시지' 커밋해줘\"".to_string());
    }

    if suggestions.is_empty() {
        suggestions.push("파일 찾기: \"현재 폴더의 js 파일 찾아줘\"".to_string());
        suggestions.push("폴더 생성: \"test 폴더 만들어줘\"".to_string());
        suggestions.push("Git 상태: \"git 상태 보여줘\"".to_string());
        suggestions.push("큰 파일 찾기: \"가장 큰 파일 10개 찾아줘\"".to_string());
    }

    suggestions
}

// 헬퍼 함수들

fn extract_extension(text: &str) -> Option<String> {
    // 패턴: "js 파일", "*.py", ".ts 파일"
    let extensions = ["js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "h", "css", "html", "json", "yaml", "yml", "md", "txt", "log"];

    for ext in &extensions {
        if text.contains(ext) {
            return Some(ext.to_string());
        }
    }
    None
}

fn extract_filename(text: &str) -> Option<String> {
    // 따옴표 안의 텍스트 추출
    if let Some(start) = text.find('"') {
        if let Some(end) = text[start+1..].find('"') {
            return Some(text[start+1..start+1+end].to_string());
        }
    }
    if let Some(start) = text.find('\'') {
        if let Some(end) = text[start+1..].find('\'') {
            return Some(text[start+1..start+1+end].to_string());
        }
    }

    // 파일명 패턴 찾기 (확장자 포함)
    let words: Vec<&str> = text.split_whitespace().collect();
    for word in words {
        if word.contains('.') && word.len() > 2 {
            let clean = word.trim_matches(|c| c == '"' || c == '\'' || c == ',' || c == '.');
            if !clean.is_empty() {
                return Some(clean.to_string());
            }
        }
    }

    None
}

fn extract_folder_name(text: &str) -> Option<String> {
    // 따옴표 안의 텍스트 추출
    if let Some(quoted) = extract_quoted_text(text) {
        return Some(quoted);
    }

    // "이름" 패턴 다음의 단어
    let words: Vec<&str> = text.split_whitespace().collect();
    for (i, word) in words.iter().enumerate() {
        if (*word == "이름" || *word == "name" || *word == "폴더") && i + 1 < words.len() {
            let next = words[i + 1].trim_matches(|c| c == '"' || c == '\'');
            if !next.is_empty() && next != "만들" && next != "생성" {
                return Some(next.to_string());
            }
        }
    }

    None
}

fn extract_quoted_text(text: &str) -> Option<String> {
    // 따옴표 안의 텍스트 추출
    if let Some(start) = text.find('"') {
        if let Some(end) = text[start+1..].find('"') {
            return Some(text[start+1..start+1+end].to_string());
        }
    }
    if let Some(start) = text.find('\'') {
        if let Some(end) = text[start+1..].find('\'') {
            return Some(text[start+1..start+1+end].to_string());
        }
    }
    None
}

fn extract_number(text: &str) -> Option<u32> {
    for word in text.split_whitespace() {
        if let Ok(num) = word.parse::<u32>() {
            return Some(num);
        }
    }
    None
}

fn extract_process_name(text: &str) -> Option<String> {
    extract_quoted_text(text).or_else(|| {
        let keywords = ["프로세스", "process", "실행", "running"];
        let words: Vec<&str> = text.split_whitespace().collect();

        for (i, word) in words.iter().enumerate() {
            if keywords.iter().any(|k| word.contains(k)) && i + 1 < words.len() {
                let next = words[i + 1].trim_matches(|c| c == '"' || c == '\'');
                if !next.is_empty() && !keywords.iter().any(|k| next.contains(k)) {
                    return Some(next.to_string());
                }
            }
        }
        None
    })
}

fn extract_package_name(text: &str) -> Option<String> {
    extract_quoted_text(text).or_else(|| {
        let keywords = ["설치", "install", "패키지", "package"];
        let words: Vec<&str> = text.split_whitespace().collect();

        for (i, word) in words.iter().enumerate() {
            if keywords.iter().any(|k| word.contains(k)) && i + 1 < words.len() {
                let next = words[i + 1].trim_matches(|c| c == '"' || c == '\'');
                if !next.is_empty() && !keywords.iter().any(|k| next.contains(k)) {
                    return Some(next.to_string());
                }
            }
        }
        None
    })
}

fn extract_env_var_name(text: &str) -> Option<String> {
    let common_vars = ["PATH", "HOME", "USER", "TEMP", "TMP", "USERPROFILE", "APPDATA"];
    let text_upper = text.to_uppercase();

    for var in &common_vars {
        if text_upper.contains(var) {
            return Some(var.to_string());
        }
    }

    extract_quoted_text(text)
}

/// 사용 가능한 패턴 목록 반환
#[tauri::command]
pub fn get_ai_patterns() -> Vec<HashMap<String, String>> {
    vec![
        create_pattern_info("파일 찾기", "\"js 파일 찾아줘\", \"find file\""),
        create_pattern_info("폴더 만들기", "\"test 폴더 만들어줘\", \"mkdir\""),
        create_pattern_info("파일 삭제", "\"파일 삭제해줘\", \"rm\""),
        create_pattern_info("큰 파일 찾기", "\"큰 파일 10개 찾아줘\""),
        create_pattern_info("파일 목록", "\"현재 폴더 보여줘\", \"ls\""),
        create_pattern_info("Git 상태", "\"git 상태\", \"변경사항\""),
        create_pattern_info("Git 커밋", "\"'메시지' 커밋해줘\""),
        create_pattern_info("Git 푸시/풀", "\"git 푸시\", \"git 풀\""),
        create_pattern_info("프로세스 확인", "\"프로세스 보여줘\", \"running\""),
        create_pattern_info("포트 확인", "\"포트 8080 확인\""),
        create_pattern_info("파일 내용", "\"파일 내용 보여줘\", \"cat\""),
        create_pattern_info("텍스트 검색", "\"'검색어' 찾아줘\", \"grep\""),
        create_pattern_info("디스크 용량", "\"디스크 용량 보여줘\""),
        create_pattern_info("시스템 정보", "\"시스템 정보 보여줘\""),
        create_pattern_info("압축/해제", "\"압축해줘\", \"압축 풀어줘\""),
    ]
}

fn create_pattern_info(name: &str, examples: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    map.insert("name".to_string(), name.to_string());
    map.insert("examples".to_string(), examples.to_string());
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_translate_file_search() {
        let result = translate_natural_language(
            "js 파일 찾아줘".to_string(),
            Some("powershell".to_string()),
        ).unwrap();

        assert!(result.success);
        assert!(result.command.unwrap().contains("Get-ChildItem"));
    }

    #[test]
    fn test_translate_mkdir() {
        let result = translate_natural_language(
            "test 폴더 만들어줘".to_string(),
            Some("bash".to_string()),
        ).unwrap();

        assert!(result.success);
        assert!(result.command.unwrap().contains("mkdir"));
    }

    #[test]
    fn test_translate_git_status() {
        let result = translate_natural_language(
            "git 상태 보여줘".to_string(),
            None,
        ).unwrap();

        assert!(result.success);
        assert_eq!(result.command.unwrap(), "git status");
    }

    #[test]
    fn test_extract_extension() {
        assert_eq!(extract_extension("js 파일 찾아줘"), Some("js".to_string()));
        assert_eq!(extract_extension("python 스크립트"), None);
        assert_eq!(extract_extension("*.py 파일"), Some("py".to_string()));
    }

    #[test]
    fn test_extract_number() {
        assert_eq!(extract_number("큰 파일 10개 찾아줘"), Some(10));
        assert_eq!(extract_number("파일 찾아줘"), None);
    }
}
