use crate::types::{ChatMessage, ChatResponse, Model, OllamaStatus};

use super::llama_cpp::LlamaCppService;
use super::ollama::OllamaService;

pub enum ProviderService {
    Ollama(OllamaService),
    LlamaCpp(LlamaCppService),
}

impl ProviderService {
    pub fn new_default() -> Self {
        if cfg!(target_os = "macos") {
            Self::LlamaCpp(LlamaCppService::new())
        } else {
            Self::Ollama(OllamaService::new())
        }
    }
    pub async fn check_status(&self) -> OllamaStatus {
        match self {
            Self::Ollama(service) => service.check_status().await,
            Self::LlamaCpp(service) => service.check_status().await,
        }
    }

    pub async fn list_models(&self) -> Result<Vec<Model>, String> {
        match self {
            Self::Ollama(service) => service.list_models().await,
            Self::LlamaCpp(service) => service.list_models().await,
        }
    }

    pub async fn chat_stream<F>(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        on_chunk: F,
    ) -> Result<(), String>
    where
        F: FnMut(ChatResponse) + Send,
    {
        match self {
            Self::Ollama(service) => service.chat_stream(model, messages, None, on_chunk).await,
            Self::LlamaCpp(service) => service.chat_stream(model, messages, on_chunk).await,
        }
    }

    pub async fn pull_model(&self, name: &str) -> Result<(), String> {
        match self {
            Self::Ollama(service) => service.pull_model(name).await,
            Self::LlamaCpp(service) => service.pull_model(name).await,
        }
    }

    pub async fn delete_model(&self, name: &str) -> Result<(), String> {
        match self {
            Self::Ollama(service) => service.delete_model(name).await,
            Self::LlamaCpp(service) => service.delete_model(name).await,
        }
    }
}
