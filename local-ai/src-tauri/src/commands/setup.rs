use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
#[cfg(target_os = "macos")]
use std::sync::OnceLock;
use std::time::Duration;

use reqwest::Client;
#[cfg(target_os = "macos")]
use tauri::Manager;
use tauri::{AppHandle, State};
#[cfg(target_os = "macos")]
use tokio::sync::Mutex;
use tokio::time::sleep;

#[cfg(target_os = "macos")]
use crate::services::database::Database;
#[cfg(target_os = "macos")]
use crate::services::llama_cpp::resolve_local_model_path;
#[cfg(target_os = "macos")]
use crate::services::llama_cpp::LlamaCppService;
use crate::DatabaseState;

#[cfg(target_os = "macos")]
static DIRECT_ENGINE_START_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
#[cfg(target_os = "macos")]
static DIRECT_ENGINE_PID: OnceLock<std::sync::Mutex<Option<u32>>> = OnceLock::new();
#[cfg(target_os = "macos")]
const GEMMA_4_CONTEXT_WINDOW_SIZE: usize = 125_000;

#[cfg(target_os = "macos")]
fn engine_pid_slot() -> &'static std::sync::Mutex<Option<u32>> {
    DIRECT_ENGINE_PID.get_or_init(|| std::sync::Mutex::new(None))
}

#[cfg(target_os = "macos")]
fn record_engine_pid(pid: u32) {
    if let Ok(mut guard) = engine_pid_slot().lock() {
        *guard = Some(pid);
    }
}

#[cfg(target_os = "macos")]
fn take_engine_pid() -> Option<u32> {
    engine_pid_slot().lock().ok().and_then(|mut guard| guard.take())
}

#[cfg(target_os = "macos")]
fn engine_pid_is_tracked() -> bool {
    engine_pid_slot()
        .lock()
        .map(|guard| guard.is_some())
        .unwrap_or(false)
}

/// Return the PID of whatever process is *listening* on port 8080, if any.
#[cfg(target_os = "macos")]
fn pid_listening_on_8080() -> Option<u32> {
    let output = Command::new("lsof")
        .args(["-nP", "-iTCP:8080", "-sTCP:LISTEN", "-t"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .next()
        .and_then(|pid| pid.trim().parse::<u32>().ok())
}

/// Decide whether the process at `pid` is an engine *we* are responsible for.
///
/// Our engine is the bundled `llama-server` that lives inside our `.app`, or one
/// we launched against our bundled model — both reference our app bundle's
/// `Contents/Resources/` directory on their command line. A user's own
/// `llama-server` (LM Studio, a manual dev run) never will, so this is a safe
/// way to avoid killing a server that isn't ours.
#[cfg(target_os = "macos")]
fn pid_is_our_engine(pid: u32) -> bool {
    let output = match Command::new("ps")
        .args(["-o", "command=", "-p", &pid.to_string()])
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return false,
    };
    let command_line = String::from_utf8_lossy(&output.stdout);
    command_line.contains("/Contents/Resources/llama-cpp/llama-server")
        || command_line.contains("/Contents/Resources/gemma-4-e4b/")
}

/// Startup reclaim: if port 8080 is already serving when we launch, an engine
/// from a previous session may have been orphaned (a crash, a force-quit, or a
/// shutdown hook that never fired). If that orphan is *ours*, adopt its PID so
/// we own its lifecycle again and shut it down cleanly on the next quit. This
/// is the self-healing counterpart to `stop_llama_server` — it guarantees we
/// recover from the termination paths no exit hook can ever intercept.
#[cfg(target_os = "macos")]
fn reclaim_orphaned_engine() {
    if engine_pid_is_tracked() {
        return; // We already own a running engine this session.
    }
    if let Some(pid) = pid_listening_on_8080() {
        if pid_is_our_engine(pid) {
            record_engine_pid(pid);
        }
    }
}

/// Called from the Tauri app exit hook so the bundled llama-server child
/// is shut down with the app. Without this the engine becomes orphaned
/// (re-parented to launchd) and keeps holding port 8080 + several GB of RAM
/// after every quit.
pub fn stop_engine_on_exit() {
    #[cfg(target_os = "macos")]
    stop_llama_server();
}

#[tauri::command]
pub async fn setup_open_external(target: String) -> Result<(), String> {
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return Err("No external target was provided.".to_string());
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("start").arg("").arg(trimmed);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(trimmed);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(trimmed);
        command
    };

    command
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to open external target: {}", error))?;

    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn setup_start_engine() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command
            .arg("/C")
            .arg("start")
            .arg("")
            .arg("ollama")
            .arg("serve");
        command
    };

    #[cfg(not(target_os = "windows"))]
    let mut command = {
        let mut command = Command::new("ollama");
        command.arg("serve");
        command
    };

    command
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            format!(
                "Failed to start engine automatically: {}. If the engine is not installed yet, install it first.",
                error
            )
        })?;

    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn setup_start_engine(
    app: AppHandle,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let model_path = read_string_setting(&state.db, "directEngineModelPath")?
        .filter(|value| !value.trim().is_empty())
        .or_else(|| resolve_bundled_model_path(&app))
        .ok_or_else(|| {
            "No GGUF model path is configured yet. Add it in Settings under llama-server Executable / GGUF Model Path, then try Start Engine again.".to_string()
        })?;
    start_llama_server(&app, &state.db, &model_path)?;
    wait_for_direct_engine().await
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn setup_switch_direct_engine_model(
    app: AppHandle,
    state: State<'_, DatabaseState>,
    model_name: String,
) -> Result<String, String> {
    let trimmed_name = model_name.trim();
    if trimmed_name.is_empty() {
        return Err("No model name was provided.".to_string());
    }

    let model_path = resolve_local_model_path(trimmed_name).ok_or_else(|| {
        format!(
            "Could not find a local GGUF file for {}. Make sure that model exists on disk first.",
            trimmed_name
        )
    })?;

    state.db.set_setting(
        "directEngineModelPath",
        &serde_json::to_string(&model_path).map_err(|error| error.to_string())?,
    )?;
    state.db.set_setting(
        "defaultModel",
        &serde_json::to_string(trimmed_name).map_err(|error| error.to_string())?,
    )?;

    if DirectEngineProfile::from_model_path(&model_path).is_gemma_4() {
        state.db.set_setting(
            "contextWindowSize",
            &serde_json::to_string(&GEMMA_4_CONTEXT_WINDOW_SIZE)
                .map_err(|error| error.to_string())?,
        )?;
    }

    stop_llama_server();
    sleep(Duration::from_millis(500)).await;
    start_llama_server(&app, &state.db, &model_path)?;
    wait_for_direct_engine().await?;

    Ok(model_path)
}

#[cfg(target_os = "macos")]
fn read_string_setting(db: &Database, key: &str) -> Result<Option<String>, String> {
    let value = db.get_setting(key)?;

    Ok(value.and_then(|raw| {
        serde_json::from_str::<String>(&raw).ok().or_else(|| {
            let trimmed = raw.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
    }))
}

#[cfg(target_os = "macos")]
fn read_usize_setting(db: &Database, key: &str) -> Result<Option<usize>, String> {
    let value = db.get_setting(key)?;

    Ok(value.and_then(|raw| {
        serde_json::from_str::<usize>(&raw)
            .ok()
            .or_else(|| raw.trim().parse::<usize>().ok())
    }))
}

#[cfg(target_os = "macos")]
fn resolve_bundled_model_path(app: &AppHandle) -> Option<String> {
    let resource_dir = app.path().resource_dir().ok()?;
    let model_path = resource_dir
        .join("gemma-4-e4b")
        .join("gemma-4-E4B-it-Q4_K_M.gguf");
    if model_path.exists() {
        Some(model_path.to_string_lossy().into_owned())
    } else {
        None
    }
}

#[cfg(target_os = "macos")]
fn resolve_llama_server_path(
    app: &AppHandle,
    configured: Option<&str>,
) -> Result<String, String> {
    let mut candidates: Vec<String> = Vec::new();

    if let Some(value) = configured {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            candidates.push(trimmed.to_string());
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("llama-cpp")
                .join("llama-server")
                .to_string_lossy()
                .into_owned(),
        );
    }

    candidates.push("/opt/homebrew/bin/llama-server".to_string());
    candidates.push("/usr/local/bin/llama-server".to_string());

    for candidate in candidates {
        if Path::new(&candidate).exists() {
            return Ok(candidate);
        }
    }

    Err(
        "Could not find llama-server. Install llama.cpp first, or set the full llama-server path in Settings."
            .to_string(),
    )
}

#[cfg(target_os = "macos")]
fn start_llama_server(
    app: &AppHandle,
    db: &Database,
    model_path: &str,
) -> Result<(), String> {
    let configured_executable = read_string_setting(db, "directEngineExecutablePath")?;
    let executable = resolve_llama_server_path(app, configured_executable.as_deref())?;
    let profile = DirectEngineProfile::from_model_path(model_path);
    let context_window_size = read_usize_setting(db, "contextWindowSize")?
        .unwrap_or(4096)
        .max(512);

    if !Path::new(model_path).exists() {
        return Err(format!(
            "The configured GGUF model was not found at {}. Update the GGUF Model Path in Settings and try again.",
            model_path
        ));
    }

    let mut command = Command::new(&executable);
    command.arg("-m").arg(model_path);

    if let Some(alias) = profile.alias() {
        command.arg("--alias").arg(alias);
    }

    command
        .arg("--ctx-size")
        .arg(context_window_size.to_string())
        .arg("--parallel")
        .arg("1")
        .arg("--cache-ram")
        .arg("0")
        .arg("--no-warmup");

    match profile {
        DirectEngineProfile::Gemma4E2B => {
            command.arg("--no-mmproj").arg("--reasoning").arg("off");
        }
        DirectEngineProfile::Gemma4E4B => {
            let mmproj_path = resolve_mmproj_path(model_path).ok_or_else(|| {
                format!(
                    "Gemma 4 E4B is the full-feature lane, but no matching mmproj file was found next to {}. Install the Gemma 4 E4B mmproj GGUF, then try again.",
                    model_path
                )
            })?;
            command
                .arg("--mmproj")
                .arg(mmproj_path)
                .arg("--reasoning")
                .arg("on")
                .arg("--reasoning-budget")
                .arg("512");
        }
        DirectEngineProfile::Other => {
            command.arg("--no-mmproj");
        }
    }

    let child = command
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg("8080")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to start llama.cpp server: {}", error))?;

    // Remember the PID so the app exit hook can shut it down cleanly.
    // std::process::Child does NOT kill on drop, so letting the handle
    // fall out of scope here is safe — the engine keeps running.
    record_engine_pid(child.id());

    Ok(())
}

#[cfg(target_os = "macos")]
pub async fn ensure_direct_engine_running(
    app: &AppHandle,
    db: &Database,
) -> Result<(), String> {
    let start_lock = DIRECT_ENGINE_START_LOCK.get_or_init(|| Mutex::new(()));
    let _guard = start_lock.lock().await;
    let provider = LlamaCppService::new();

    if provider.check_status().await.running {
        // Port 8080 is already serving. If it's an engine we orphaned in a
        // previous session, adopt its PID so we can shut it down on quit
        // instead of leaking it again. Foreign servers are left untouched.
        reclaim_orphaned_engine();
        return Ok(());
    }

    let Some(model_path) = read_string_setting(db, "directEngineModelPath")?
        .filter(|value| !value.trim().is_empty())
        .or_else(|| resolve_bundled_model_path(app))
    else {
        return Ok(());
    };

    start_llama_server(app, db, &model_path)?;
    wait_for_direct_engine().await
}

#[cfg(target_os = "macos")]
fn stop_llama_server() {
    // Only kill the llama-server *we* spawned. The previous pkill -f approach
    // would also terminate any other llama-server the user might be running
    // (LM Studio, manual dev runs, etc.) which is unfriendly.
    if let Some(pid) = take_engine_pid() {
        let _ = Command::new("kill")
            .arg(pid.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

#[cfg(target_os = "macos")]
async fn wait_for_direct_engine() -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|error| format!("Failed to create direct-engine status client: {}", error))?;

    let url = "http://127.0.0.1:8080/v1/models";

    for _ in 0..30 {
        if let Ok(response) = client.get(url).send().await {
            if response.status().is_success() {
                return Ok(());
            }
        }

        sleep(Duration::from_millis(500)).await;
    }

    Err("The direct engine did not come back online after switching models. Give it a moment and try again.".to_string())
}

#[cfg(target_os = "macos")]
enum DirectEngineProfile {
    Gemma4E2B,
    Gemma4E4B,
    Other,
}

#[cfg(target_os = "macos")]
impl DirectEngineProfile {
    fn from_model_path(model_path: &str) -> Self {
        let Some(lower) = Path::new(model_path)
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
        else {
            return Self::Other;
        };

        if lower.contains("gemma-4-e4b") {
            Self::Gemma4E4B
        } else if lower.contains("gemma-4-e2b") {
            Self::Gemma4E2B
        } else {
            Self::Other
        }
    }

    fn alias(&self) -> Option<&'static str> {
        match self {
            Self::Gemma4E2B => Some("google/gemma-4-e2b"),
            Self::Gemma4E4B => Some("google/gemma-4-e4b"),
            Self::Other => None,
        }
    }

    fn is_gemma_4(&self) -> bool {
        matches!(self, Self::Gemma4E2B | Self::Gemma4E4B)
    }
}

#[cfg(target_os = "macos")]
fn resolve_mmproj_path(model_path: &str) -> Option<PathBuf> {
    let model_path = Path::new(model_path);
    let model_file = model_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())?;
    let model_dir = model_path.parent()?;
    let model_lane = if model_file.contains("gemma-4-e4b") {
        Some("gemma-4-e4b")
    } else if model_file.contains("gemma-4-e2b") {
        Some("gemma-4-e2b")
    } else {
        None
    }?;

    find_mmproj_in_dir(model_dir, model_lane)
}

#[cfg(target_os = "macos")]
fn find_mmproj_in_dir(dir: &Path, model_lane: &str) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    let mut fallback = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            continue;
        }

        let Some(file_name) = path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
        else {
            continue;
        };

        if !file_name.ends_with(".gguf") || !file_name.starts_with("mmproj") {
            continue;
        }

        fallback.get_or_insert_with(|| path.clone());

        if file_name.contains(model_lane) {
            return Some(path);
        }
    }

    fallback
}
