use std::fs;
use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════
// DATA STRUCTURES
// ═══════════════════════════════════════════

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: String,
    pub repo: String,
    pub branch: String,
    pub mode: String,
    pub target_path: String,
    pub start_date: String,
    pub span_days: u32,
    pub times: Vec<String>,
    pub timezone: String,
    pub jitter_minutes: u32,
    pub notify_before_minutes: u32,
    pub abort_behavior: String,
    pub dry_run: bool,
    pub skip_dates: Vec<String>,
    pub intensity: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub alert_provider: Option<String>,
    pub webhook_url: Option<String>,
    pub gh_pat: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Config {
    pub schedules: Vec<Schedule>,
    #[serde(default)]
    pub settings: Option<Settings>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct QueueItem {
    pub name: String,
    pub file_type: String,
    pub status: String,
    pub depends_on: Option<String>,
    pub not_eligible_until: Option<String>,
    pub priority: Option<String>,
    pub held: Option<bool>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct ItemMeta {
    pub depends_on: Option<String>,
    pub not_eligible_until: Option<String>,
    pub priority: Option<String>,
    pub held: Option<bool>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct CommandResult {
    pub success: bool,
    pub message: String,
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

/// Get the root path of the git-drip project (parent of desktop/)
fn get_project_root() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    // During development, the exe is deep in target/debug/
    // We navigate up to find the project root by looking for config.json
    let mut path = exe_path.clone();
    for _ in 0..10 {
        path = match path.parent() {
            Some(p) => p.to_path_buf(),
            None => break,
        };
        if path.join("config.json").exists() {
            return Ok(path);
        }
    }
    // Fallback: try the current working directory
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    if cwd.join("config.json").exists() {
        return Ok(cwd);
    }
    // Fallback: try parent of cwd (if we're in desktop/)
    if let Some(parent) = cwd.parent() {
        if parent.join("config.json").exists() {
            return Ok(parent.to_path_buf());
        }
    }
    Err("Could not locate project root (config.json not found). Make sure you run the app from the project directory.".to_string())
}

// ═══════════════════════════════════════════
// COMMAND: Read config.json
// ═══════════════════════════════════════════

#[tauri::command]
fn read_config() -> Result<Config, String> {
    let root = get_project_root()?;
    let config_path = root.join("config.json");
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.json: {}", e))?;
    let config: Config = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config.json: {}", e))?;
    Ok(config)
}

// ═══════════════════════════════════════════
// COMMAND: Write config.json
// ═══════════════════════════════════════════

#[tauri::command]
fn write_config(config: Config) -> Result<CommandResult, String> {
    let root = get_project_root()?;
    let config_path = root.join("config.json");
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config.json: {}", e))?;
    Ok(CommandResult {
        success: true,
        message: "Config saved successfully.".to_string(),
    })
}

// ═══════════════════════════════════════════
// COMMAND: Read queue (pending + used)
// ═══════════════════════════════════════════

#[tauri::command]
fn read_queue() -> Result<Vec<QueueItem>, String> {
    let root = get_project_root()?;
    let mut items: Vec<QueueItem> = Vec::new();

    // Read pending queue
    let pending_dir = root.join("queue").join("pending");
    if pending_dir.exists() {
        if let Ok(entries) = fs::read_dir(&pending_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".meta.json") || name.ends_with(".flag") {
                    continue;
                }

                // Try read meta sidecar
                let meta_path = pending_dir.join(format!("{}.meta.json", name));
                let mut depends_on = None;
                let mut not_eligible_until = None;
                let mut priority = None;
                let mut held = None;
                let mut file_type = "feature".to_string();

                if let Ok(content) = fs::read_to_string(&meta_path) {
                    if let Ok(meta) = serde_json::from_str::<ItemMeta>(&content) {
                        depends_on = meta.depends_on;
                        not_eligible_until = meta.not_eligible_until;
                        priority = meta.priority;
                        held = meta.held;
                        if let Some(t) = meta.item_type { file_type = t; }
                    }
                }

                items.push(QueueItem {
                    name,
                    file_type,
                    status: "pending".to_string(),
                    depends_on,
                    not_eligible_until,
                    priority,
                    held,
                });
            }
        }
    }

    // Read used queue
    let used_dir = root.join("queue").join("used");
    if used_dir.exists() {
        if let Ok(entries) = fs::read_dir(&used_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".meta.json") {
                    continue;
                }
                items.push(QueueItem {
                    name,
                    file_type: "feature".to_string(),
                    status: "synced".to_string(),
                    depends_on: None,
                    not_eligible_until: None,
                    priority: None,
                    held: None,
                });
            }
        }
    }

    Ok(items)
}

// ═══════════════════════════════════════════
// COMMAND: Add file to queue
// ═══════════════════════════════════════════

#[tauri::command]
fn add_to_queue(source_path: String, schedule_id: String, file_type: String) -> Result<CommandResult, String> {
    let root = get_project_root()?;
    let pending_dir = root.join("queue").join("pending");

    // Ensure pending directory exists
    fs::create_dir_all(&pending_dir)
        .map_err(|e| format!("Failed to create pending directory: {}", e))?;

    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }

    // Sanitize: only allow files, not directories or path traversals
    if !source.is_file() {
        return Err("Only files can be added to the queue.".to_string());
    }

    let file_name = source.file_name()
        .ok_or("Invalid file name")?
        .to_string_lossy()
        .to_string();

    // Security: reject file names with path traversal
    if file_name.contains("..") || file_name.contains('/') || file_name.contains('\\') {
        return Err("Invalid file name detected.".to_string());
    }

    let dest = pending_dir.join(&file_name);

    // Copy the file to queue/pending/
    fs::copy(&source, &dest)
        .map_err(|e| format!("Failed to copy file to queue: {}", e))?;

    // Create the .meta.json sidecar
    let meta = serde_json::json!({
        "scheduleId": schedule_id,
        "type": file_type
    });
    let meta_path = pending_dir.join(format!("{}.meta.json", file_name));
    fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap())
        .map_err(|e| format!("Failed to write meta file: {}", e))?;

    Ok(CommandResult {
        success: true,
        message: format!("'{}' added to queue for schedule '{}'.", file_name, schedule_id),
    })
}

// ═══════════════════════════════════════════
// COMMAND: Remove file from queue
// ═══════════════════════════════════════════

#[tauri::command]
fn remove_from_queue(file_name: String) -> Result<CommandResult, String> {
    let root = get_project_root()?;
    let pending_dir = root.join("queue").join("pending");

    // Security: sanitize file name
    if file_name.contains("..") || file_name.contains('/') || file_name.contains('\\') {
        return Err("Invalid file name.".to_string());
    }

    let file_path = pending_dir.join(&file_name);
    let meta_path = pending_dir.join(format!("{}.meta.json", file_name));

    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| format!("Failed to remove file: {}", e))?;
    }
    if meta_path.exists() {
        fs::remove_file(&meta_path).map_err(|e| format!("Failed to remove meta: {}", e))?;
    }

    Ok(CommandResult {
        success: true,
        message: format!("'{}' removed from queue.", file_name),
    })
}

// ═══════════════════════════════════════════
// COMMAND: Sync to GitHub (git add, commit, push)
// ═══════════════════════════════════════════

#[tauri::command]
fn sync_to_github() -> Result<CommandResult, String> {
    let root = get_project_root()?;

    // Step 1: git add .
    let add_output = Command::new("git")
        .args(["add", "."])
        .current_dir(&root)
        .output()
        .map_err(|e| format!("Failed to run 'git add': {}", e))?;

    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr);
        return Err(format!("git add failed: {}", stderr));
    }

    // Step 2: Check if there is anything to commit
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&root)
        .output()
        .map_err(|e| format!("Failed to run 'git status': {}", e))?;

    let status_text = String::from_utf8_lossy(&status_output.stdout);
    if status_text.trim().is_empty() {
        return Ok(CommandResult {
            success: true,
            message: "Nothing to commit. Already up to date.".to_string(),
        });
    }

    // Step 3: git commit
    let commit_output = Command::new("git")
        .args(["commit", "-m", "chore: update queue via Commit Chrono"])
        .current_dir(&root)
        .output()
        .map_err(|e| format!("Failed to run 'git commit': {}", e))?;

    if !commit_output.status.success() {
        let stderr = String::from_utf8_lossy(&commit_output.stderr);
        return Err(format!("git commit failed: {}", stderr));
    }

    // Step 4: git push
    let push_output = Command::new("git")
        .args(["push"])
        .current_dir(&root)
        .output()
        .map_err(|e| format!("Failed to run 'git push': {}", e))?;

    if !push_output.status.success() {
        let stderr = String::from_utf8_lossy(&push_output.stderr);
        return Err(format!("git push failed: {}", stderr));
    }

    Ok(CommandResult {
        success: true,
        message: "Successfully synced to GitHub.".to_string(),
    })
}

// ═══════════════════════════════════════════
// COMMAND: Update Item Meta
// ═══════════════════════════════════════════

#[tauri::command]
fn update_item_meta(file_name: String, depends_on: Option<String>, not_eligible_until: Option<String>, priority: Option<String>, held: Option<bool>) -> Result<CommandResult, String> {
    let root = get_project_root()?;
    let meta_path = root.join("queue").join("pending").join(format!("{}.meta.json", file_name));

    if !meta_path.exists() {
        return Err(format!("Meta file not found for {}", file_name));
    }

    let content = fs::read_to_string(&meta_path).map_err(|e| e.to_string())?;
    let mut meta: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(obj) = meta.as_object_mut() {
        obj.insert("dependsOn".to_string(), match depends_on { Some(v) if !v.is_empty() => serde_json::json!(v), _ => serde_json::Value::Null });
        obj.insert("notEligibleUntil".to_string(), match not_eligible_until { Some(v) if !v.is_empty() => serde_json::json!(v), _ => serde_json::Value::Null });
        if let Some(p) = priority { obj.insert("priority".to_string(), serde_json::json!(p)); }
        if let Some(h) = held { obj.insert("held".to_string(), serde_json::json!(h)); }
    }

    fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap()).map_err(|e| e.to_string())?;
    Ok(CommandResult { success: true, message: "Item updated.".to_string() })
}

// ═══════════════════════════════════════════
// COMMAND: Read Pending Pushes (T-n alerts)
// ═══════════════════════════════════════════

#[tauri::command]
fn read_pending_pushes() -> Result<serde_json::Value, String> {
    let root = get_project_root()?;
    let log_path = root.join("logs").join("pending-push.json");
    if !log_path.exists() {
        return Ok(serde_json::json!({ "armedSlots": [] }));
    }
    let content = fs::read_to_string(&log_path).unwrap_or_else(|_| "{\"armedSlots\":[]}".to_string());
    let data: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::json!({ "armedSlots": [] }));
    Ok(data)
}

// ═══════════════════════════════════════════
// COMMAND: Abort Push
// ═══════════════════════════════════════════

#[tauri::command]
fn abort_push(schedule_id: String, slot_id: String) -> Result<CommandResult, String> {
    let root = get_project_root()?;
    let pending_dir = root.join("queue").join("pending");
    fs::create_dir_all(&pending_dir).unwrap();

    let safe_id = slot_id.replace(":", "-").replace(".", "-");
    let flag_path = pending_dir.join(format!("abort-{}-{}.flag", schedule_id, safe_id));
    fs::write(&flag_path, "").map_err(|e| e.to_string())?;

    Ok(CommandResult { success: true, message: "Abort flag created.".to_string() })
}

// ═══════════════════════════════════════════
// COMMAND: Get project root path (for UI display)
// ═══════════════════════════════════════════

#[tauri::command]
fn get_project_path() -> Result<String, String> {
    let root = get_project_root()?;
    Ok(root.to_string_lossy().to_string())
}

// ═══════════════════════════════════════════
// APP ENTRY POINT
// ═══════════════════════════════════════════

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_config,
            write_config,
            read_queue,
            add_to_queue,
            remove_from_queue,
            sync_to_github,
            get_project_path,
            update_item_meta,
            read_pending_pushes,
            abort_push
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
