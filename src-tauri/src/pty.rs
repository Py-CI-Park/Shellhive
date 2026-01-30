use parking_lot::Mutex;
use portable_pty::{Child, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtySession {
    pub id: String,
    pub working_dir: String,
    pub shell: String,
}

struct PtySessionData {
    session: PtySession,
    master: Box<dyn MasterPty + Send>,
    _child: Box<dyn Child + Send>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySessionData>>>,
}

impl Default for PtyManager {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl PtyManager {
    pub fn new() -> Self {
        Self::default()
    }
}

#[tauri::command]
pub async fn create_pty(
    app: AppHandle,
    state: tauri::State<'_, PtyManager>,
    working_dir: String,
    shell: Option<String>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let shell_cmd = shell.unwrap_or_else(|| "cmd.exe".to_string());

    // Create PTY system
    let pty_system = NativePtySystem::default();

    // Open PTY with default size
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Create command
    let mut cmd = CommandBuilder::new(&shell_cmd);
    cmd.cwd(&working_dir);

    // Spawn command
    let child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    // Get reader for output
    let mut reader = pty_pair.master.try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    // Store session
    let session = PtySession {
        id: id.clone(),
        working_dir: working_dir.clone(),
        shell: shell_cmd.clone(),
    };

    let session_data = PtySessionData {
        session: session.clone(),
        master: pty_pair.master,
        _child: child,
    };

    state.sessions.lock().insert(id.clone(), session_data);

    // Spawn background task to read PTY output
    let session_id = id.clone();
    let app_handle = app.clone();
    tokio::spawn(async move {
        let mut buf_reader = BufReader::new(reader);
        let mut line = Vec::new();

        loop {
            line.clear();
            match buf_reader.read_until(b'\n', &mut line) {
                Ok(0) => {
                    // EOF reached, PTY closed
                    let _ = app_handle.emit(&format!("pty-exit:{}", session_id), ());
                    break;
                }
                Ok(_) => {
                    // Convert bytes to string (lossy conversion for invalid UTF-8)
                    let output = String::from_utf8_lossy(&line).to_string();

                    // Emit to frontend
                    let _ = app_handle.emit(
                        &format!("pty-data:{}", session_id),
                        output
                    );
                }
                Err(e) => {
                    eprintln!("PTY read error: {}", e);
                    let _ = app_handle.emit(&format!("pty-error:{}", session_id), format!("{}", e));
                    break;
                }
            }
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn write_pty(
    state: tauri::State<'_, PtyManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock();

    if let Some(session_data) = sessions.get_mut(&session_id) {
        let mut writer = session_data.master.take_writer()
            .map_err(|e| format!("Failed to get writer: {}", e))?;

        writer.write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;

        writer.flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;

        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

#[tauri::command]
pub async fn resize_pty(
    state: tauri::State<'_, PtyManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock();

    if let Some(session_data) = sessions.get(&session_id) {
        session_data.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))?;

        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

#[tauri::command]
pub async fn kill_pty(
    state: tauri::State<'_, PtyManager>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock();

    if sessions.remove(&session_id).is_some() {
        // Session data is dropped here, which will close the PTY and kill the child process
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}
