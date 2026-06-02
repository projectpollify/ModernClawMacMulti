use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use super::memory::MemoryState;
#[cfg(target_os = "macos")]
use super::setup::ensure_direct_engine_running;
use crate::services::agent_repo::AgentRepository;
use crate::services::context::ContextBuilder;
use crate::services::local_tools::{
    format_tool_result_for_model, parse_local_tool_call, LocalToolService,
};
use crate::services::memory::MemoryService;
use crate::services::provider::ProviderService;
use crate::types::{BuildContextResponse, ChatMessage, ChatResponse, EngineStatus, Model};
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
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    model: String,
    messages: Vec<ChatMessage>,
    conversationId: String,
) -> Result<(), String> {
    let provider = state.provider.lock().await;
    let mut working_messages = messages;

    for _ in 0..3 {
        let mut response: Option<ChatResponse> = None;

        provider
            .chat_stream(&model, working_messages.clone(), |chunk: ChatResponse| {
                response = Some(chunk);
            })
            .await?;

        let Some(chunk) = response else {
            return Err("No response received from the local model.".to_string());
        };

        let content = chunk.message.content.trim().to_string();

        if let Some(tool_call) = parse_local_tool_call(&content) {
            let agent_repo = AgentRepository::new(&db_state.db);
            let workspace_path =
                agent_repo.resolve_active_workspace_path(&memory_state.root_path)?;
            let memory_service = MemoryService::new(&workspace_path);
            memory_service.initialize()?;

            let tool_service = LocalToolService::new(&db_state.db, memory_service);
            let tool_result = tool_service.execute(tool_call);

            working_messages.push(ChatMessage {
                role: "assistant".to_string(),
                content,
                images: Vec::new(),
            });
            working_messages.push(ChatMessage {
                role: "system".to_string(),
                content: format_tool_result_for_model(&tool_result),
                images: Vec::new(),
            });

            continue;
        }

        let _ = app.emit(&format!("chat-chunk-{}", conversationId), &chunk);
        return Ok(());
    }

    Err("The model kept requesting tools and did not produce a final answer.".to_string())
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
