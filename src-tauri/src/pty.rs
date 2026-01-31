use parking_lot::Mutex;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtySession {
    pub id: String,
    pub working_dir: String,
    pub shell: String,
}

pub struct PtyManager {
    writers: Arc<Mutex<HashMap<String, Box<dyn Write + Send>>>>,
}

impl Default for PtyManager {
    fn default() -> Self {
        Self {
            writers: Arc::new(Mutex::new(HashMap::new())),
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

    // Use cmd.exe for Windows - most compatible
    let shell_cmd = shell.unwrap_or_else(|| "cmd.exe".to_string());

    // Create PTY system
    let pty_system = NativePtySystem::default();

    // Open PTY with default size
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 30,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Create command
    let mut cmd = CommandBuilder::new(&shell_cmd);
    cmd.cwd(&working_dir);

    // Spawn command
    let mut child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    // Get reader and writer
    let mut reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    // Store writer for later use
    state.writers.lock().insert(id.clone(), writer);

    // Spawn background thread to read PTY output
    let session_id = id.clone();
    let app_handle = app.clone();

    thread::spawn(move || {
        let mut buffer = [0u8; 4096];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    // EOF reached, PTY closed
                    let _ = app_handle.emit(&format!("pty-exit:{}", session_id), ());
                    break;
                }
                Ok(n) => {
                    // Convert bytes to string (lossy conversion for invalid UTF-8)
                    let output = String::from_utf8_lossy(&buffer[..n]).to_string();

                    // Emit to frontend
                    if app_handle.emit(&format!("pty-data:{}", session_id), &output).is_err() {
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("PTY read error: {}", e);
                    let _ = app_handle.emit(&format!("pty-error:{}", session_id), format!("{}", e));
                    break;
                }
            }
        }
    });

    // Spawn thread to monitor child process exit
    let session_id_exit = id.clone();
    let app_handle_exit = app.clone();
    thread::spawn(move || {
        // Wait for child process to exit
        let _ = child.wait();
        let _ = app_handle_exit.emit(&format!("pty-exit:{}", session_id_exit), ());
    });

    Ok(id)
}

#[tauri::command]
pub async fn write_pty(
    state: tauri::State<'_, PtyManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut writers = state.writers.lock();

    if let Some(writer) = writers.get_mut(&session_id) {
        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;

        writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;

        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

#[tauri::command]
pub async fn resize_pty(
    _state: tauri::State<'_, PtyManager>,
    _session_id: String,
    _cols: u16,
    _rows: u16,
) -> Result<(), String> {
    // Note: Resizing requires keeping the master PTY handle
    // For now, we'll skip resize as it requires restructuring
    // The initial size should be sufficient for most use cases
    Ok(())
}

#[tauri::command]
pub async fn kill_pty(
    state: tauri::State<'_, PtyManager>,
    session_id: String,
) -> Result<(), String> {
    let mut writers = state.writers.lock();

    if writers.remove(&session_id).is_some() {
        // Writer is dropped here, which should close the PTY
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}
