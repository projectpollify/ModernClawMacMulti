use serde_json::Value;
use tauri::State;

use super::memory::MemoryState;
use crate::services::agent_repo::AgentRepository;
use crate::services::local_tools::{LocalToolCall, LocalToolResult, LocalToolService};
use crate::services::memory::MemoryService;
use crate::DatabaseState;

#[tauri::command]
#[allow(non_snake_case)]
pub async fn local_tool_execute(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    name: String,
    arguments: Value,
) -> Result<LocalToolResult, String> {
    let agent_repo = AgentRepository::new(&db_state.db);
    let workspace_path = agent_repo.resolve_active_workspace_path(&memory_state.root_path)?;
    let memory_service = MemoryService::new(&workspace_path);
    memory_service.initialize()?;

    let tool_service = LocalToolService::new(&db_state.db, memory_service);
    Ok(tool_service.execute(LocalToolCall { name, arguments }))
}
