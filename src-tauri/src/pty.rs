use parking_lot::Mutex;
use portable_pty::{CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
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

// Store both the master PTY handle and the writer
struct PtySessionData {
    #[allow(dead_code)]
    master: Box<dyn MasterPty + Send>, // Keep master alive!
    writer: Arc<Mutex<Box<dyn Write + Send>>>, // Per-session lock for writer
    child: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send>>>>,
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
    env_vars: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();

    // Use cmd.exe for Windows - most compatible
    let shell_cmd = shell.unwrap_or_else(|| "cmd.exe".to_string());

    println!("[PTY] Creating session {} with shell: {}", id, shell_cmd);
    println!("[PTY] Working directory: {}", working_dir);

    // Create PTY system
    let pty_system = NativePtySystem::default();

    // Open PTY with reasonable size
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 30,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| {
            println!("[PTY] Failed to open PTY: {}", e);
            format!("Failed to open PTY: {}", e)
        })?;

    println!("[PTY] PTY opened successfully");

    // Create command
    let mut cmd = CommandBuilder::new(&shell_cmd);
    cmd.cwd(&working_dir);

    // Add environment variables if provided
    if let Some(vars) = env_vars {
        println!("[PTY] Setting {} environment variables", vars.len());
        for (key, value) in vars {
            cmd.env(key, value);
        }
    }

    // Spawn command
    let child = pty_pair.slave.spawn_command(cmd).map_err(|e| {
        println!("[PTY] Failed to spawn command: {}", e);
        format!("Failed to spawn command: {}", e)
    })?;

    println!("[PTY] Command spawned successfully");

    // Wrap child in Arc<Mutex> for shared ownership
    let child_handle: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send>>>> =
        Arc::new(Mutex::new(Some(child)));
    let child_for_monitor = Arc::clone(&child_handle);

    // Get reader for output
    let mut reader = pty_pair.master.try_clone_reader().map_err(|e| {
        println!("[PTY] Failed to clone reader: {}", e);
        format!("Failed to clone reader: {}", e)
    })?;

    println!("[PTY] Reader cloned successfully");

    // Get writer for input - this must be called before storing master
    let writer = pty_pair.master.take_writer().map_err(|e| {
        println!("[PTY] Failed to take writer: {}", e);
        format!("Failed to take writer: {}", e)
    })?;

    println!("[PTY] Writer taken successfully");

    // Wrap writer in Arc<Mutex> for per-session locking
    let writer = Arc::new(Mutex::new(writer));

    // Store session data - IMPORTANT: master must be kept alive!
    let session_data = PtySessionData {
        master: pty_pair.master,
        writer,
        child: child_handle,
    };

    state.sessions.lock().insert(id.clone(), session_data);
    println!("[PTY] Session stored");

    // Spawn background thread to read PTY output
    let session_id = id.clone();
    let app_handle = app.clone();

    thread::spawn(move || {
        println!("[PTY] Reader thread started for session {}", session_id);
        let mut buffer = [0u8; 4096];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    println!("[PTY] EOF received for session {}", session_id);
                    let _ = app_handle.emit(&format!("pty-exit:{}", session_id), ());
                    break;
                }
                Ok(n) => {
                    let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                    if app_handle
                        .emit(&format!("pty-data:{}", session_id), &output)
                        .is_err()
                    {
                        println!("[PTY] Failed to emit data for session {}", session_id);
                        break;
                    }
                }
                Err(e) => {
                    println!("[PTY] Read error for session {}: {}", session_id, e);
                    let _ = app_handle.emit(&format!("pty-error:{}", session_id), format!("{}", e));
                    break;
                }
            }
        }
        println!("[PTY] Reader thread ended for session {}", session_id);
    });

    // Spawn thread to monitor child process exit using polling
    let session_id_exit = id.clone();
    let app_handle_exit = app.clone();
    thread::spawn(move || {
        println!(
            "[PTY] Child monitor thread started for session {}",
            session_id_exit
        );

        loop {
            // Check if child still exists and poll its status
            let should_exit = {
                let mut guard = child_for_monitor.lock();
                if let Some(ref mut child) = *guard {
                    // try_wait returns Ok(Some(status)) if exited, Ok(None) if still running
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            println!(
                                "[PTY] Child exited for session {}: {:?}",
                                session_id_exit, status
                            );
                            true
                        }
                        Ok(None) => false, // Still running
                        Err(e) => {
                            println!(
                                "[PTY] Error checking child status for session {}: {}",
                                session_id_exit, e
                            );
                            true
                        }
                    }
                } else {
                    // Child was taken (killed externally)
                    println!(
                        "[PTY] Child was killed externally for session {}",
                        session_id_exit
                    );
                    true
                }
            };

            if should_exit {
                let _ = app_handle_exit.emit(&format!("pty-exit:{}", session_id_exit), ());
                break;
            }

            // Poll every 100ms
            thread::sleep(std::time::Duration::from_millis(100));
        }

        println!(
            "[PTY] Child monitor thread ended for session {}",
            session_id_exit
        );
    });

    println!("[PTY] Session {} created successfully", id);
    Ok(id)
}

#[tauri::command]
pub async fn write_pty(
    state: tauri::State<'_, PtyManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    // Get writer Arc with minimal global lock time
    let writer = {
        let sessions = state.sessions.lock();
        sessions
            .get(&session_id)
            .map(|s| Arc::clone(&s.writer))
            .ok_or_else(|| format!("Session not found: {}", session_id))?
    };
    // Global sessions lock released here

    // Perform I/O with per-session lock only
    let mut writer_guard = writer.lock();
    writer_guard.write_all(data.as_bytes()).map_err(|e| {
        println!("[PTY] Write error for session {}: {}", session_id, e);
        format!("Failed to write to PTY: {}", e)
    })?;

    writer_guard.flush().map_err(|e| {
        println!("[PTY] Flush error for session {}: {}", session_id, e);
        format!("Failed to flush PTY: {}", e)
    })?;

    Ok(())
}

#[tauri::command]
pub async fn resize_pty(
    state: tauri::State<'_, PtyManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    // Perform resize while holding lock for minimal time
    let resize_result = {
        let sessions = state.sessions.lock();

        if let Some(session_data) = sessions.get(&session_id) {
            session_data
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {}", e))
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }; // Lock is released here

    resize_result
}

#[tauri::command]
pub async fn kill_pty(
    state: tauri::State<'_, PtyManager>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock();

    if let Some(session_data) = sessions.remove(&session_id) {
        // Explicitly kill the child process if it still exists
        if let Some(mut child) = session_data.child.lock().take() {
            if let Err(e) = child.kill() {
                println!("[PTY] Warning: Failed to kill child process: {}", e);
            }
        }
        println!("[PTY] Session {} killed", session_id);
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pty_manager_creation() {
        let manager = PtyManager::new();
        assert!(manager.sessions.lock().is_empty());
    }

    #[test]
    fn test_pty_manager_default() {
        let manager = PtyManager::default();
        assert!(manager.sessions.lock().is_empty());
    }
}
