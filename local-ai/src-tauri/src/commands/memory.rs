use tauri::State;

use crate::services::agent_repo::AgentRepository;
use crate::services::memory::MemoryService;
use crate::types::{CuratorPackage, DailyLog, MemoryContext, MemoryFile, MessageAttachment};
use crate::DatabaseState;

pub struct MemoryState {
    pub root_path: String,
}

impl MemoryState {
    fn resolve_service(&self, db: &crate::services::database::Database) -> Result<MemoryService, String> {
        let agent_repo = AgentRepository::new(db);
        let workspace_path = agent_repo.resolve_active_workspace_path(&self.root_path)?;
        let service = MemoryService::new(&workspace_path);
        service.initialize()?;
        Ok(service)
    }
}

#[tauri::command]
pub async fn memory_initialize(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
) -> Result<(), String> {
    let service = state.resolve_service(&db_state.db)?;
    service.initialize()
}

#[tauri::command]
pub async fn memory_read_file(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
    filename: String,
) -> Result<MemoryFile, String> {
    let service = state.resolve_service(&db_state.db)?;
    service.read_file(&filename)
}

#[tauri::command]
pub async fn memory_write_file(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
    filename: String,
    content: String,
) -> Result<(), String> {
    let service = state.resolve_service(&db_state.db)?;
    service.write_file(&filename, &content)
}

#[tauri::command]
pub async fn memory_get_today_log(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
) -> Result<DailyLog, String> {
    let service = state.resolve_service(&db_state.db)?;
    service.get_today_log()
}

#[tauri::command]
pub async fn memory_append_log(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
    entry: String,
) -> Result<(), String> {
    let service = state.resolve_service(&db_state.db)?;
    service.append_to_today_log(&entry)
}

#[tauri::command]
pub async fn memory_list_daily_logs(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
) -> Result<Vec<String>, String> {
    let service = state.resolve_service(&db_state.db)?;
    service.list_daily_logs()
}

#[tauri::command]
pub async fn memory_list_knowledge(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
) -> Result<Vec<String>, String> {
    let service = state.resolve_service(&db_state.db)?;
    service.list_knowledge_files()
}

#[tauri::command]
pub async fn memory_list_curator_staged(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
) -> Result<Vec<CuratorPackage>, String> {
    let service = state.resolve_service(&db_state.db)?;
    service.list_curator_staged_packages()
}

#[tauri::command]
pub async fn memory_import_curator_package(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
    folder_name: String,
) -> Result<String, String> {
    let service = state.resolve_service(&db_state.db)?;
    service.import_curator_package(&folder_name)
}

#[tauri::command]
pub async fn memory_reject_curator_package(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
    folder_name: String,
) -> Result<(), String> {
    let service = state.resolve_service(&db_state.db)?;
    service.reject_curator_package(&folder_name)
}

#[tauri::command]
pub async fn memory_load_context(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
) -> Result<MemoryContext, String> {
    let service = state.resolve_service(&db_state.db)?;
    service.load_context()
}

#[tauri::command]
pub async fn memory_get_base_path(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
) -> Result<String, String> {
    let service = state.resolve_service(&db_state.db)?;
    Ok(service.get_base_path())
}

#[tauri::command]
pub async fn memory_open_folder(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
) -> Result<(), String> {
    let service = state.resolve_service(&db_state.db)?;
    service.open_base_path()
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn memory_store_chat_attachment(
    db_state: State<'_, DatabaseState>,
    state: State<'_, MemoryState>,
    conversationId: String,
    filename: String,
    kind: String,
    mimeType: Option<String>,
    extractedText: Option<String>,
    bytes: Vec<u8>,
) -> Result<MessageAttachment, String> {
    if kind != "image" && kind != "audio" && kind != "document" {
        return Err("Unsupported attachment kind".to_string());
    }

    let service = state.resolve_service(&db_state.db)?;
    service.store_chat_attachment(
        &conversationId,
        &filename,
        &kind,
        mimeType.as_deref(),
        extractedText.as_deref(),
        &bytes,
    )
}
