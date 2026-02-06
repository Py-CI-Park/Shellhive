use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Shared session information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SharedSession {
    pub id: String,
    pub owner_id: String,
    pub share_code: String,
    pub created_at: i64,
}

/// Sharing manager for terminal sessions
pub struct SharingManager {
    sessions: HashMap<String, SharedSession>,
}

impl SharingManager {
    pub fn new() -> Self {
        SharingManager {
            sessions: HashMap::new(),
        }
    }

    /// Generate a unique 6-character share code
    fn generate_share_code(&self) -> String {
        const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let mut rng = rand::thread_rng();

        loop {
            let code: String = (0..6)
                .map(|_| {
                    let idx = rng.gen_range(0..CHARSET.len());
                    CHARSET[idx] as char
                })
                .collect();

            // Ensure code is unique
            if !self.sessions.values().any(|s| s.share_code == code) {
                return code;
            }
        }
    }

    /// Start sharing a session, returns the share code
    pub fn start_sharing(&mut self, session_id: &str, owner_id: &str) -> String {
        // If already sharing, return existing code
        if let Some(session) = self.sessions.get(session_id) {
            return session.share_code.clone();
        }

        let share_code = self.generate_share_code();
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let shared_session = SharedSession {
            id: session_id.to_string(),
            owner_id: owner_id.to_string(),
            share_code: share_code.clone(),
            created_at,
        };

        self.sessions.insert(session_id.to_string(), shared_session);
        share_code
    }

    /// Stop sharing a session
    pub fn stop_sharing(&mut self, session_id: &str) -> bool {
        self.sessions.remove(session_id).is_some()
    }

    /// Find a shared session by share code
    pub fn find_by_code(&self, code: &str) -> Option<&SharedSession> {
        let code_upper = code.to_uppercase();
        self.sessions.values().find(|s| s.share_code == code_upper)
    }

    /// Get sharing status for a session
    pub fn get_status(&self, session_id: &str) -> Option<&SharedSession> {
        self.sessions.get(session_id)
    }

    /// Get all shared sessions
    pub fn list_shared(&self) -> Vec<&SharedSession> {
        self.sessions.values().collect()
    }
}

impl Default for SharingManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Global sharing manager state
pub struct SharingState(pub Mutex<SharingManager>);

impl SharingState {
    pub fn new() -> Self {
        SharingState(Mutex::new(SharingManager::new()))
    }
}

impl Default for SharingState {
    fn default() -> Self {
        Self::new()
    }
}

// ===== Tauri Commands =====

/// Start sharing a terminal session
#[tauri::command]
pub fn start_session_sharing(
    session_id: String,
    owner_id: Option<String>,
    state: tauri::State<'_, SharingState>,
) -> Result<String, String> {
    let mut manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let owner = owner_id.unwrap_or_else(|| "local".to_string());
    let code = manager.start_sharing(&session_id, &owner);

    Ok(code)
}

/// Stop sharing a terminal session
#[tauri::command]
pub fn stop_session_sharing(
    session_id: String,
    state: tauri::State<'_, SharingState>,
) -> Result<bool, String> {
    let mut manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(manager.stop_sharing(&session_id))
}

/// Get sharing status for a session
#[tauri::command]
pub fn get_sharing_status(
    session_id: String,
    state: tauri::State<'_, SharingState>,
) -> Result<Option<SharedSession>, String> {
    let manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(manager.get_status(&session_id).cloned())
}

/// Find a shared session by code
#[tauri::command]
pub fn find_shared_session(
    code: String,
    state: tauri::State<'_, SharingState>,
) -> Result<Option<SharedSession>, String> {
    let manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(manager.find_by_code(&code).cloned())
}

/// List all shared sessions
#[tauri::command]
pub fn list_shared_sessions(
    state: tauri::State<'_, SharingState>,
) -> Result<Vec<SharedSession>, String> {
    let manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(manager.list_shared().into_iter().cloned().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sharing_manager() {
        let mut manager = SharingManager::new();

        // Start sharing
        let code = manager.start_sharing("session1", "user1");
        assert_eq!(code.len(), 6);

        // Find by code
        let session = manager.find_by_code(&code);
        assert!(session.is_some());
        assert_eq!(session.unwrap().id, "session1");

        // Get status
        let status = manager.get_status("session1");
        assert!(status.is_some());

        // Stop sharing
        let stopped = manager.stop_sharing("session1");
        assert!(stopped);

        // Verify stopped
        let status = manager.get_status("session1");
        assert!(status.is_none());
    }

    #[test]
    fn test_share_code_generation() {
        let mut manager = SharingManager::new();

        // Generate multiple codes and ensure uniqueness
        let code1 = manager.start_sharing("session1", "user1");
        let code2 = manager.start_sharing("session2", "user2");

        assert_ne!(code1, code2);
        assert_eq!(code1.len(), 6);
        assert_eq!(code2.len(), 6);
    }
}
