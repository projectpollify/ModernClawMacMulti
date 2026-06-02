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
const GEMMA_4_CONTEXT_WINDOW_SIZE: usize = 125_000;

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

    command
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg("8080")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to start llama.cpp server: {}", error))?;

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
        return Ok(());
    }

    let Some(model_path) =
        read_string_setting(db, "directEngineModelPath")?.filter(|value| !value.trim().is_empty())
    else {
        return Ok(());
    };

    start_llama_server(app, db, &model_path)?;
    wait_for_direct_engine().await
}

#[cfg(target_os = "macos")]
fn stop_llama_server() {
    let _ = Command::new("pkill")
        .arg("-f")
        .arg("llama-server")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
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
