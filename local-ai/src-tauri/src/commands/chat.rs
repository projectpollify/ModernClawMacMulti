use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use super::memory::MemoryState;
#[cfg(target_os = "macos")]
use super::setup::ensure_direct_engine_running;
use crate::services::agent_repo::AgentRepository;
use crate::services::context::ContextBuilder;
use crate::services::memory::MemoryService;
use crate::services::provider::ProviderService;
use crate::types::{
    BuildContextResponse, ChatMessage, ChatResponse, EngineStatus, Model,
};
use crate::DatabaseState;

pub struct AppState {
    pub provider: Arc<Mutex<ProviderService>>,
}

#[tauri::command]
pub async fn check_engine_status(
    state: State<'_, AppState>,
    #[cfg(target_os = "macos")] db_state: State<'_, DatabaseState>,
) -> Result<EngineStatus, String> {
    #[cfg(target_os = "macos")]
    if let Err(error) = ensure_direct_engine_running(&db_state.db).await {
        return Ok(EngineStatus {
            running: false,
            version: Some("llama.cpp".to_string()),
            error: Some(error),
        });
    }

    let provider = state.provider.lock().await;
    Ok(provider.check_status().await)
}

#[tauri::command]
pub async fn list_models(state: State<'_, AppState>) -> Result<Vec<Model>, String> {
    let provider = state.provider.lock().await;
    provider.list_models().await
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn build_context(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    maxTokens: Option<usize>,
    conversationHistory: Vec<ChatMessage>,
    userMessage: ChatMessage,
) -> Result<BuildContextResponse, String> {
    let agent_repo = AgentRepository::new(&db_state.db);
    let workspace_path = agent_repo.resolve_active_workspace_path(&memory_state.root_path)?;
    let memory_service = MemoryService::new(&workspace_path);
    let memory_context = memory_service.load_context()?;

    let context_builder = ContextBuilder::new(maxTokens.unwrap_or(4096));
    let (messages, stats) =
        context_builder.build_with_stats(&memory_context, &conversationHistory, &userMessage);

    Ok(BuildContextResponse { messages, stats })
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn chat_send(
    app: AppHandle,
    state: State<'_, AppState>,
    model: String,
    messages: Vec<ChatMessage>,
    conversationId: String,
) -> Result<(), String> {
    let provider = state.provider.lock().await;

    provider
        .chat_stream(&model, messages, |chunk: ChatResponse| {
            let _ = app.emit(&format!("chat-chunk-{}", conversationId), &chunk);
        })
        .await
}

#[tauri::command]
pub async fn pull_model(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
) -> Result<(), String> {
    let provider = state.provider.lock().await;
    let result = provider.pull_model(&name).await;

    if result.is_ok() {
        let _ = app.emit(
            "model-pull-progress",
            &crate::types::EnginePullProgress {
                model: name.clone(),
                status: "success".to_string(),
                digest: None,
                total: None,
                completed: None,
                done: true,
            },
        );
    }

    result
}

#[tauri::command]
pub async fn delete_model(state: State<'_, AppState>, name: String) -> Result<(), String> {
    let provider = state.provider.lock().await;
    provider.delete_model(&name).await
}
