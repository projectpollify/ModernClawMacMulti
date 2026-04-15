use chrono::{DateTime, Utc};
use std::path::Path;

use crate::services::database::Database;
use crate::types::Agent;

pub const MAIN_WORKSPACE_ID: &str = "default";
pub const MAIN_WORKSPACE_NAME: &str = "Main Brain";
pub const JOE_SUPPORT_ID: &str = "joe-support";
pub const JOE_SUPPORT_NAME: &str = "Joe Support";
const MAIN_WORKSPACE_DESCRIPTION: &str =
    "Primary local workspace for chat, memory, knowledge, and settings.";
const JOE_SUPPORT_DESCRIPTION: &str =
    "Built-in AI support assistant for setup, troubleshooting, and product guidance.";
#[cfg(target_os = "macos")]
const DEFAULT_AGENT_MODEL: &str = "google/gemma-4-e4b";
#[cfg(not(target_os = "macos"))]
const DEFAULT_AGENT_MODEL: &str = "gemma4:e4b";
const MAIN_WORKSPACE_PIPER_VOICE_PRESET: &str = "amy-medium";
const JOE_SUPPORT_PIPER_VOICE_PRESET: &str = "joe-medium";
const LEGACY_DEFAULT_AGENT_NAME: &str = "Default Brain";
const PREVIOUS_DEFAULT_AGENT_NAME: &str = "Gemma 4";
const LEGACY_MAIN_WORKSPACE_NAME: &str = "Main Workspace";
const PREVIOUS_MAIN_WORKSPACE_NAME: &str = "Rosie";
const LEGACY_DEFAULT_AGENT_MODEL: &str = "nchapman/dolphin3.0-qwen2.5:3b";

pub struct AgentRepository<'a> {
    db: &'a Database,
}

impl<'a> AgentRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub fn create(&self, agent: &Agent) -> Result<(), String> {
        self.db.execute(
            r#"
            INSERT INTO agents (
                agent_id,
                name,
                description,
                status,
                workspace_path,
                default_model,
                enable_voice_output,
                piper_voice_preset,
                piper_model_path,
                enable_voice_input,
                whisper_model_path,
                whisper_language,
                created_at,
                updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            "#,
            &[
                &agent.agent_id,
                &agent.name,
                &agent.description,
                &agent.status,
                &agent.workspace_path,
                &agent.default_model,
                &agent.enable_voice_output,
                &agent.piper_voice_preset,
                &agent.piper_model_path,
                &agent.enable_voice_input,
                &agent.whisper_model_path,
                &agent.whisper_language,
                &agent.created_at.to_rfc3339(),
                &agent.updated_at.to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    pub fn list(&self) -> Result<Vec<Agent>, String> {
        self.db.query_all(
            r#"
            SELECT agent_id, name, description, status, workspace_path, default_model,
                   enable_voice_output, piper_voice_preset, piper_model_path,
                   enable_voice_input, whisper_model_path, whisper_language,
                   created_at, updated_at
            FROM agents
            ORDER BY CASE agent_id
                WHEN ?1 THEN 0
                WHEN ?2 THEN 1
                ELSE 2
            END, updated_at DESC, name ASC
            "#,
            &[&MAIN_WORKSPACE_ID, &JOE_SUPPORT_ID],
            |row| {
                Ok(Agent {
                    agent_id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    status: row.get(3)?,
                    workspace_path: row.get(4)?,
                    default_model: row.get(5)?,
                    enable_voice_output: row.get(6)?,
                    piper_voice_preset: row.get(7)?,
                    piper_model_path: row.get(8)?,
                    enable_voice_input: row.get(9)?,
                    whisper_model_path: row.get(10)?,
                    whisper_language: row.get(11)?,
                    created_at: parse_rfc3339(row.get(12)?)?,
                    updated_at: parse_rfc3339(row.get(13)?)?,
                })
            },
        )
    }

    pub fn get(&self, agent_id: &str) -> Result<Option<Agent>, String> {
        self.db.query_one(
            r#"
            SELECT agent_id, name, description, status, workspace_path, default_model,
                   enable_voice_output, piper_voice_preset, piper_model_path,
                   enable_voice_input, whisper_model_path, whisper_language,
                   created_at, updated_at
            FROM agents
            WHERE agent_id = ?1
            "#,
            &[&agent_id],
            |row| {
                Ok(Agent {
                    agent_id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    status: row.get(3)?,
                    workspace_path: row.get(4)?,
                    default_model: row.get(5)?,
                    enable_voice_output: row.get(6)?,
                    piper_voice_preset: row.get(7)?,
                    piper_model_path: row.get(8)?,
                    enable_voice_input: row.get(9)?,
                    whisper_model_path: row.get(10)?,
                    whisper_language: row.get(11)?,
                    created_at: parse_rfc3339(row.get(12)?)?,
                    updated_at: parse_rfc3339(row.get(13)?)?,
                })
            },
        )
    }

    pub fn update_default_model(&self, agent_id: &str, default_model: Option<&str>) -> Result<(), String> {
        if !is_builtin_profile_id(agent_id) {
            return Err("Only built-in base profiles can be updated in this version.".to_string());
        }

        if self.get(agent_id)?.is_none() {
            return Err(format!("Agent not found: {}", agent_id));
        }

        let now = Utc::now().to_rfc3339();
        let next_model = default_model.map(|value| value.to_string());

        self.db.execute(
            r#"
            UPDATE agents
            SET default_model = ?1,
                updated_at = ?2
            WHERE agent_id = ?3
            "#,
            &[&next_model, &now, &agent_id],
        )?;

        Ok(())
    }

    pub fn delete(&self, agent_id: &str) -> Result<(), String> {
        self.db.execute("DELETE FROM agents WHERE agent_id = ?1", &[&agent_id])?;
        Ok(())
    }

    pub fn update_voice_settings(
        &self,
        agent_id: &str,
        enable_voice_output: Option<bool>,
        piper_voice_preset: Option<&str>,
        piper_model_path: Option<&str>,
        enable_voice_input: Option<bool>,
        whisper_model_path: Option<&str>,
        whisper_language: Option<&str>,
    ) -> Result<(), String> {
        if !is_builtin_profile_id(agent_id) {
            return Err("Only built-in base profiles can be updated in this version.".to_string());
        }

        if self.get(agent_id)?.is_none() {
            return Err(format!("Agent not found: {}", agent_id));
        }

        let now = Utc::now().to_rfc3339();
        let next_piper_voice_preset = piper_voice_preset.map(|value| value.to_string());
        let next_piper_model_path = piper_model_path.map(|value| value.to_string());
        let next_whisper_model_path = whisper_model_path.map(|value| value.to_string());
        let next_whisper_language = whisper_language.map(|value| value.to_string());

        self.db.execute(
            r#"
            UPDATE agents
            SET enable_voice_output = ?1,
                piper_voice_preset = ?2,
                piper_model_path = ?3,
                enable_voice_input = ?4,
                whisper_model_path = ?5,
                whisper_language = ?6,
                updated_at = ?7
            WHERE agent_id = ?8
            "#,
            &[
                &enable_voice_output,
                &next_piper_voice_preset,
                &next_piper_model_path,
                &enable_voice_input,
                &next_whisper_model_path,
                &next_whisper_language,
                &now,
                &agent_id,
            ],
        )?;

        Ok(())
    }

    pub fn ensure_base_profiles(&self, default_workspace_path: &str) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();
        let legacy_description = "Migrated baseline single-brain workspace";

        self.insert_builtin_profile(
            MAIN_WORKSPACE_ID,
            MAIN_WORKSPACE_NAME,
            MAIN_WORKSPACE_DESCRIPTION,
            default_workspace_path,
            DEFAULT_AGENT_MODEL,
            MAIN_WORKSPACE_PIPER_VOICE_PRESET,
            &now,
        )?;
        self.insert_builtin_profile(
            JOE_SUPPORT_ID,
            JOE_SUPPORT_NAME,
            JOE_SUPPORT_DESCRIPTION,
            default_workspace_path,
            DEFAULT_AGENT_MODEL,
            JOE_SUPPORT_PIPER_VOICE_PRESET,
            &now,
        )?;

        self.db.execute(
            r#"
            UPDATE agents
            SET workspace_path = ?1,
                name = CASE
                    WHEN name = ?2 OR name = ?3 OR name = ?4 OR name = ?5 THEN ?6
                    ELSE name
                END,
                description = CASE
                    WHEN description IS NULL OR description = '' OR description = ?7 THEN ?8
                    ELSE description
                END,
                default_model = CASE
                    WHEN default_model IS NULL OR default_model = '' OR default_model = ?9 THEN ?10
                    ELSE default_model
                END,
                piper_voice_preset = CASE
                    WHEN piper_voice_preset IS NULL OR piper_voice_preset = '' THEN ?11
                    ELSE piper_voice_preset
                END,
                updated_at = ?12
            WHERE agent_id = ?13
            "#,
            &[
                &default_workspace_path,
                &LEGACY_DEFAULT_AGENT_NAME,
                &PREVIOUS_DEFAULT_AGENT_NAME,
                &LEGACY_MAIN_WORKSPACE_NAME,
                &PREVIOUS_MAIN_WORKSPACE_NAME,
                &MAIN_WORKSPACE_NAME,
                &legacy_description,
                &MAIN_WORKSPACE_DESCRIPTION,
                &LEGACY_DEFAULT_AGENT_MODEL,
                &DEFAULT_AGENT_MODEL,
                &MAIN_WORKSPACE_PIPER_VOICE_PRESET,
                &now,
                &MAIN_WORKSPACE_ID,
            ],
        )?;

        self.db.execute(
            r#"
            UPDATE agents
            SET workspace_path = ?1,
                name = ?2,
                description = CASE
                    WHEN description IS NULL OR description = '' THEN ?3
                    ELSE description
                END,
                default_model = CASE
                    WHEN default_model IS NULL OR default_model = '' OR default_model = ?4 THEN ?5
                    ELSE default_model
                END,
                piper_voice_preset = CASE
                    WHEN piper_voice_preset IS NULL OR piper_voice_preset = '' THEN ?6
                    ELSE piper_voice_preset
                END,
                updated_at = ?7
            WHERE agent_id = ?8
            "#,
            &[
                &default_workspace_path,
                &JOE_SUPPORT_NAME,
                &JOE_SUPPORT_DESCRIPTION,
                &LEGACY_DEFAULT_AGENT_MODEL,
                &DEFAULT_AGENT_MODEL,
                &JOE_SUPPORT_PIPER_VOICE_PRESET,
                &now,
                &JOE_SUPPORT_ID,
            ],
        )?;

        let active_agent_id = self.db.get_setting("active_agent_id")?;

        let active_agent_missing = match active_agent_id {
            Some(ref value) => self.get(value)?.is_none(),
            None => true,
        };

        if active_agent_missing {
            self.db.set_setting("active_agent_id", MAIN_WORKSPACE_ID)?;
        }

        Ok(())
    }

    pub fn get_active_agent_id(&self) -> Result<String, String> {
        Ok(self
            .db
            .get_setting("active_agent_id")?
            .unwrap_or_else(|| MAIN_WORKSPACE_ID.to_string()))
    }

    pub fn set_active_agent(&self, agent_id: &str) -> Result<(), String> {
        if self.get(agent_id)?.is_none() {
            return Err(format!("Agent not found: {}", agent_id));
        }

        self.db.set_setting("active_agent_id", agent_id)
    }

    pub fn get_active_agent(&self, default_workspace_path: &str) -> Result<Agent, String> {
        self.ensure_base_profiles(default_workspace_path)?;

        let active_agent_id = self.get_active_agent_id()?;

        if let Some(agent) = self.get(&active_agent_id)? {
            return Ok(agent);
        }

        self.db.set_setting("active_agent_id", MAIN_WORKSPACE_ID)?;
        self.get(MAIN_WORKSPACE_ID)?
            .ok_or_else(|| "Main brain profile could not be resolved".to_string())
    }

    pub fn resolve_active_workspace_path(&self, default_workspace_path: &str) -> Result<String, String> {
        Ok(self.get_active_agent(default_workspace_path)?.workspace_path)
    }

    pub fn default_workspace_path_for_new_agent(default_workspace_root: &str, agent_id: &str) -> String {
        Path::new(default_workspace_root)
            .join("agents")
            .join(agent_id)
            .to_string_lossy()
            .to_string()
    }

    fn insert_builtin_profile(
        &self,
        agent_id: &str,
        name: &str,
        description: &str,
        workspace_path: &str,
        default_model: &str,
        piper_voice_preset: &str,
        now: &str,
    ) -> Result<(), String> {
        let active_status = "active";
        let description = Some(description.to_string());
        let default_model = Some(default_model.to_string());
        let piper_voice_preset = Some(piper_voice_preset.to_string());

        self.db.execute(
            r#"
            INSERT OR IGNORE INTO agents (
                agent_id,
                name,
                description,
                status,
                workspace_path,
                default_model,
                enable_voice_output,
                piper_voice_preset,
                piper_model_path,
                enable_voice_input,
                whisper_model_path,
                whisper_language,
                created_at,
                updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            "#,
            &[
                &agent_id,
                &name,
                &description,
                &active_status,
                &workspace_path,
                &default_model,
                &Option::<bool>::None,
                &piper_voice_preset,
                &Option::<String>::None,
                &Option::<bool>::None,
                &Option::<String>::None,
                &Option::<String>::None,
                &now,
                &now,
            ],
        )?;

        Ok(())
    }
}

fn is_builtin_profile_id(agent_id: &str) -> bool {
    matches!(agent_id, MAIN_WORKSPACE_ID | JOE_SUPPORT_ID)
}

fn parse_rfc3339(value: String) -> rusqlite::Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(&value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                value.len(),
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })
}
