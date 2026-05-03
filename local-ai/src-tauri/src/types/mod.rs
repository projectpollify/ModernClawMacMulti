use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Model {
    pub name: String,
    pub modified_at: String,
    pub size: u64,
    pub digest: String,
    #[serde(default)]
    pub details: ModelDetails,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ModelDetails {
    pub format: Option<String>,
    pub family: Option<String>,
    pub parameter_size: Option<String>,
    pub quantization_level: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<Model>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub images: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<ChatOptions>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_ctx: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatResponse {
    pub model: String,
    pub created_at: String,
    pub message: ChatMessage,
    pub done: bool,
    #[serde(default)]
    pub total_duration: Option<u64>,
    #[serde(default)]
    pub eval_count: Option<u32>,
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EngineStatus {
    pub running: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnginePullProgress {
    #[serde(default)]
    pub model: String,
    pub status: String,
    #[serde(default)]
    pub digest: Option<String>,
    #[serde(default)]
    pub total: Option<u64>,
    #[serde(default)]
    pub completed: Option<u64>,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub agent_id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub workspace_path: String,
    pub default_model: Option<String>,
    pub enable_voice_output: Option<bool>,
    pub piper_voice_preset: Option<String>,
    pub piper_model_path: Option<String>,
    pub enable_voice_input: Option<bool>,
    pub whisper_model_path: Option<String>,
    pub whisper_language: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub agent_id: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub model: String,
    pub message_count: i32,
    pub preview: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub attachments: Vec<MessageAttachment>,
    pub tokens_used: Option<i32>,
    pub feedback: Option<String>,
    pub feedback_note: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageAttachment {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub path: String,
    pub mime_type: Option<String>,
    pub size_bytes: Option<u64>,
    #[serde(default)]
    pub extracted_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageFeedbackSummary {
    pub assistant_message_count: i32,
    pub rated_count: i32,
    pub helpful_count: i32,
    pub not_useful_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryConfig {
    pub base_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryFile {
    pub name: String,
    pub path: String,
    pub content: String,
    pub exists: bool,
    pub modified_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyLog {
    pub date: String,
    pub path: String,
    pub content: String,
    pub exists: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryContext {
    pub soul: Option<String>,
    pub user: Option<String>,
    pub memory: Option<String>,
    pub today_log: Option<String>,
    pub knowledge_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CuratorPackage {
    pub id: String,
    pub folder_name: String,
    pub title: String,
    pub summary: Option<String>,
    pub source: Option<String>,
    pub tags: Vec<String>,
    pub request_topic: Option<String>,
    pub created_at: Option<String>,
    pub status: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContextStats {
    pub system_tokens: usize,
    pub history_tokens: usize,
    pub total_tokens: usize,
    pub max_tokens: usize,
    pub messages_included: usize,
    pub messages_truncated: usize,
    pub usage_percent: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BuildContextResponse {
    pub messages: Vec<ChatMessage>,
    pub stats: ContextStats,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VoiceStatus {
    pub available: bool,
    pub piper_found: bool,
    pub model_found: bool,
    pub executable_path: Option<String>,
    pub model_path: Option<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeechToTextStatus {
    pub available: bool,
    pub whisper_found: bool,
    pub model_found: bool,
    pub executable_path: Option<String>,
    pub model_path: Option<String>,
    pub notes: Vec<String>,
}
