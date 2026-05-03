use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::services::agent_repo::{AgentRepository, JOE_SUPPORT_ID};
use crate::services::conversation_repo::ConversationRepository;
use crate::types::Agent;
use crate::{DatabaseState, MemoryState};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDto {
    pub agent_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub workspace_path: Option<String>,
    #[serde(default)]
    pub default_model: Option<String>,
    #[serde(default)]
    pub enable_voice_output: Option<bool>,
    #[serde(default)]
    pub piper_voice_preset: Option<String>,
    #[serde(default)]
    pub piper_model_path: Option<String>,
    #[serde(default)]
    pub enable_voice_input: Option<bool>,
    #[serde(default)]
    pub whisper_model_path: Option<String>,
    #[serde(default)]
    pub whisper_language: Option<String>,
    #[serde(default)]
    pub profile_kind: Option<String>,
    #[serde(default)]
    pub shares_primary_workspace: Option<bool>,
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
}

impl From<Agent> for AgentDto {
    fn from(value: Agent) -> Self {
        let is_default = value.agent_id == "default";
        let is_support = value.agent_id == JOE_SUPPORT_ID;
        let profile_kind = if is_support {
            "support"
        } else if is_default {
            "main"
        } else {
            "custom"
        };

        Self {
            agent_id: value.agent_id,
            name: value.name,
            description: value.description,
            status: Some(value.status),
            workspace_path: Some(value.workspace_path),
            default_model: value.default_model,
            enable_voice_output: value.enable_voice_output,
            piper_voice_preset: value.piper_voice_preset,
            piper_model_path: value.piper_model_path,
            enable_voice_input: value.enable_voice_input,
            whisper_model_path: value.whisper_model_path,
            whisper_language: value.whisper_language,
            profile_kind: Some(profile_kind.to_string()),
            shares_primary_workspace: Some(is_default),
            created_at: Some(value.created_at),
            updated_at: Some(value.updated_at),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentVoiceSettingsDto {
    #[serde(default)]
    pub enable_voice_output: Option<bool>,
    #[serde(default)]
    pub piper_voice_preset: Option<String>,
    #[serde(default)]
    pub piper_model_path: Option<String>,
    #[serde(default)]
    pub enable_voice_input: Option<bool>,
    #[serde(default)]
    pub whisper_model_path: Option<String>,
    #[serde(default)]
    pub whisper_language: Option<String>,
}

#[tauri::command]
pub async fn agent_list(state: State<'_, DatabaseState>) -> Result<Vec<AgentDto>, String> {
    let repo = AgentRepository::new(&state.db);
    Ok(repo.list()?.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn agent_get_active(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
) -> Result<AgentDto, String> {
    let repo = AgentRepository::new(&db_state.db);
    Ok(repo.get_active_agent(&memory_state.root_path)?.into())
}

#[tauri::command]
pub async fn agent_set_active(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    agent_id: String,
) -> Result<(), String> {
    let repo = AgentRepository::new(&db_state.db);
    repo.ensure_base_profiles(&memory_state.root_path)?;
    repo.set_active_agent(&agent_id)
}

#[tauri::command]
pub async fn agent_create(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    agent: AgentDto,
) -> Result<(), String> {
    let repo = AgentRepository::new(&db_state.db);
    repo.ensure_base_profiles(&memory_state.root_path)?;

    let now = Utc::now();
    let workspace_path = agent.workspace_path.unwrap_or_else(|| {
        AgentRepository::default_workspace_path_for_new_agent(&memory_state.root_path, &agent.agent_id)
    });

    let new_agent = Agent {
        agent_id: agent.agent_id,
        name: agent.name,
        description: agent.description,
        status: agent.status.unwrap_or_else(|| "active".to_string()),
        workspace_path: workspace_path.clone(),
        default_model: agent.default_model,
        enable_voice_output: agent.enable_voice_output,
        piper_voice_preset: agent.piper_voice_preset,
        piper_model_path: agent.piper_model_path,
        enable_voice_input: agent.enable_voice_input,
        whisper_model_path: agent.whisper_model_path,
        whisper_language: agent.whisper_language,
        created_at: agent.created_at.unwrap_or(now),
        updated_at: agent.updated_at.unwrap_or(now),
    };

    repo.create(&new_agent)?;

    let service = crate::services::memory::MemoryService::new(&workspace_path);
    service.initialize()?;

    Ok(())
}

#[tauri::command]
pub async fn agent_update_default_model(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    agent_id: String,
    default_model: Option<String>,
) -> Result<(), String> {
    let repo = AgentRepository::new(&db_state.db);
    repo.ensure_base_profiles(&memory_state.root_path)?;
    repo.update_default_model(&agent_id, default_model.as_deref())
}

#[tauri::command]
pub async fn agent_rename(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    agent_id: String,
    name: String,
) -> Result<(), String> {
    let repo = AgentRepository::new(&db_state.db);
    repo.ensure_base_profiles(&memory_state.root_path)?;
    repo.update_name(&agent_id, &name)
}

#[tauri::command]
pub async fn agent_update_voice_settings(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    agent_id: String,
    voice_settings: AgentVoiceSettingsDto,
) -> Result<(), String> {
    let repo = AgentRepository::new(&db_state.db);
    repo.ensure_base_profiles(&memory_state.root_path)?;
    repo.update_voice_settings(
        &agent_id,
        voice_settings.enable_voice_output,
        voice_settings.piper_voice_preset.as_deref(),
        voice_settings.piper_model_path.as_deref(),
        voice_settings.enable_voice_input,
        voice_settings.whisper_model_path.as_deref(),
        voice_settings.whisper_language.as_deref(),
    )
}

#[tauri::command]
pub async fn agent_delete(
    db_state: State<'_, DatabaseState>,
    memory_state: State<'_, MemoryState>,
    agent_id: String,
) -> Result<(), String> {
    let repo = AgentRepository::new(&db_state.db);
    repo.ensure_base_profiles(&memory_state.root_path)?;

    if agent_id == "default" || agent_id == JOE_SUPPORT_ID {
        return Err("Built-in brains cannot be deleted in this version.".to_string());
    }

    let agents = repo.list()?;
    if agents.len() <= 1 {
        return Err("You cannot delete the only remaining brain.".to_string());
    }

    let target = repo
        .get(&agent_id)?
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    let active_agent_id = repo.get_active_agent_id()?;
    if active_agent_id == agent_id {
        let replacement = agents
            .iter()
            .find(|agent| agent.agent_id != agent_id)
            .ok_or_else(|| "No replacement brain available.".to_string())?;
        repo.set_active_agent(&replacement.agent_id)?;
    }

    let conversation_repo = ConversationRepository::new(&db_state.db);
    conversation_repo.delete_for_agent(&agent_id)?;
    repo.delete(&agent_id)?;

    if is_managed_agent_workspace(&memory_state.root_path, &target.workspace_path) {
        fs::remove_dir_all(&target.workspace_path)
            .map_err(|error| format!("Failed to remove brain workspace: {}", error))?;
    }

    Ok(())
}

fn is_managed_agent_workspace(root_path: &str, workspace_path: &str) -> bool {
    let managed_root = Path::new(root_path).join("agents");
    Path::new(workspace_path).starts_with(managed_root)
}
