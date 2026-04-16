mod commands;
mod services;
mod types;

use std::io::Error as IoError;
use std::path::PathBuf;
use std::sync::Arc;

use commands::agents::{
    agent_create, agent_delete, agent_get_active, agent_list, agent_set_active,
    agent_update_default_model, agent_update_voice_settings,
};
use commands::chat::{
    build_context, chat_send, check_engine_status, delete_model, list_models, pull_model, AppState,
};
use commands::history::{
    conversation_create, conversation_delete, conversation_get, conversation_list,
    conversation_search, conversation_update, message_create, message_feedback_summary,
    message_set_feedback, messages_get,
};
use commands::memory::{
    memory_append_log, memory_get_base_path, memory_get_today_log, memory_import_curator_package,
    memory_initialize, memory_list_curator_staged, memory_list_daily_logs, memory_list_knowledge,
    memory_load_context, memory_open_folder, memory_read_file, memory_reject_curator_package,
    memory_store_chat_attachment, memory_write_file, MemoryState,
};
use commands::setup::{setup_open_external, setup_start_engine, setup_switch_direct_engine_model};
use commands::settings::{setting_get, setting_set, settings_get_all, settings_reset};
use commands::voice::{voice_check_input_status, voice_check_status, voice_speak, voice_transcribe};
use services::agent_repo::AgentRepository;
use services::database::Database;
use services::memory::MemoryService;
use services::provider::ProviderService;
use tauri::Manager;
use tokio::sync::Mutex;

pub struct DatabaseState {
    pub db: Database,
}

fn setup_database(app: &tauri::App) -> Result<DatabaseState, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to get app data dir: {}", error))?;

    let db_path = app_data.join("data.db");
    let db = Database::new(&db_path)?;

    Ok(DatabaseState { db })
}

fn default_memory_path(app: &tauri::App) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to get app data dir: {}", error))?;
    let parent = app_data.parent().unwrap_or(app_data.as_path());
    let folder_name = if cfg!(target_os = "linux") {
        "localai"
    } else {
        "LocalAI"
    };

    Ok(parent.join(folder_name))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        provider: Arc::new(Mutex::new(ProviderService::new_default())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let db_state = setup_database(app)
                .map_err(|error| IoError::other(format!("Database setup failed: {}", error)))?;
            let default_root_path = default_memory_path(app)
                .map_err(|error| IoError::other(format!("Memory path resolution failed: {}", error)))?;

            let default_root_path_string = default_root_path.to_string_lossy().to_string();
            let agent_repo = AgentRepository::new(&db_state.db);
            agent_repo
                .ensure_base_profiles(&default_root_path_string)
                .map_err(|error| IoError::other(format!("Agent setup failed: {}", error)))?;

            let active_workspace_path = agent_repo
                .resolve_active_workspace_path(&default_root_path_string)
                .map_err(|error| IoError::other(format!("Active workspace resolution failed: {}", error)))?;

            let memory_service = MemoryService::new(&active_workspace_path);
            memory_service
                .initialize()
                .map_err(|error| IoError::other(format!("Memory setup failed: {}", error)))?;

            let memory_state = MemoryState {
                root_path: default_root_path_string,
            };

            app.manage(db_state);
            app.manage(memory_state);
            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            check_engine_status,
            list_models,
            build_context,
            chat_send,
            pull_model,
            delete_model,
            agent_list,
            agent_get_active,
            agent_set_active,
            agent_create,
            agent_update_default_model,
            agent_update_voice_settings,
            agent_delete,
            conversation_create,
            conversation_list,
            conversation_get,
            conversation_update,
            conversation_delete,
            conversation_search,
            message_create,
            message_feedback_summary,
            message_set_feedback,
            messages_get,
            memory_initialize,
            memory_read_file,
            memory_write_file,
            memory_get_today_log,
            memory_append_log,
            memory_list_daily_logs,
            memory_list_knowledge,
            memory_list_curator_staged,
            memory_import_curator_package,
            memory_reject_curator_package,
            memory_load_context,
            memory_get_base_path,
            memory_open_folder,
            memory_store_chat_attachment,
            setup_open_external,
            setup_start_engine,
            setup_switch_direct_engine_model,
            settings_get_all,
            setting_set,
            setting_get,
            settings_reset,
            voice_check_status,
            voice_check_input_status,
            voice_speak,
            voice_transcribe
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
