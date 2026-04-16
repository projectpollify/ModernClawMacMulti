use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::time::Duration;

use futures_util::StreamExt;
use reqwest::Client;

use crate::types::{
    ChatMessage, ChatOptions, ChatRequest, ChatResponse, EnginePullProgress, EngineStatus, Model,
    ModelsResponse,
};

const ENGINE_LEGACY_BASE_URL: &str = "http://localhost:11434";

pub struct EngineLegacyService {
    client: Client,
    base_url: String,
}

impl EngineLegacyService {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .expect("failed to create engine HTTP client");

        Self {
            client,
            base_url: ENGINE_LEGACY_BASE_URL.to_string(),
        }
    }

    pub async fn check_status(&self) -> EngineStatus {
        match self
            .client
            .get(format!("{}/api/tags", self.base_url))
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => EngineStatus {
                running: true,
                version: None,
                error: None,
            },
            Ok(resp) => EngineStatus {
                running: false,
                version: None,
                error: Some(format!("Unexpected status: {}", resp.status())),
            },
            Err(error) => EngineStatus {
                running: false,
                version: None,
                error: Some(error.to_string()),
            },
        }
    }

    pub async fn list_models(&self) -> Result<Vec<Model>, String> {
        let response = self
            .client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await
            .map_err(|error| format!("Request failed: {}", error))?;

        if !response.status().is_success() {
            return Err(format!("Failed to list models: {}", response.status()));
        }

        let models: ModelsResponse = response
            .json()
            .await
            .map_err(|error| format!("Parse error: {}", error))?;

        Ok(models.models)
    }

    #[allow(dead_code)]
    pub async fn chat(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
    ) -> Result<ChatResponse, String> {
        let prepared_messages = self.prepare_messages_for_request(messages)?;
        let request = ChatRequest {
            model: model.to_string(),
            messages: prepared_messages,
            stream: Some(false),
            options: None,
        };

        let response = self
            .client
            .post(format!("{}/api/chat", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|error| format!("Request failed: {}", error))?;

        if !response.status().is_success() {
            return Err(format!("Chat failed: {}", response.status()));
        }

        response
            .json()
            .await
            .map_err(|error| format!("Parse error: {}", error))
    }

    pub async fn chat_stream<F>(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        options: Option<ChatOptions>,
        mut on_chunk: F,
    ) -> Result<(), String>
    where
        F: FnMut(ChatResponse) + Send,
    {
        let prepared_messages = self.prepare_messages_for_request(messages)?;
        let request = ChatRequest {
            model: model.to_string(),
            messages: prepared_messages,
            stream: Some(true),
            options,
        };

        let response = self
            .client
            .post(format!("{}/api/chat", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|error| format!("Request failed: {}", error))?;

        if !response.status().is_success() {
            return Err(format!("Chat failed: {}", response.status()));
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("Stream error: {}", error))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.trim().is_empty() {
                    continue;
                }

                match serde_json::from_str::<ChatResponse>(&line) {
                    Ok(response) => {
                        let is_done = response.done;
                        on_chunk(response);
                        if is_done {
                            return Ok(());
                        }
                    }
                    Err(error) => {
                        eprintln!("Failed to parse chunk: {} - {}", line, error);
                    }
                }
            }
        }

        if !buffer.trim().is_empty() {
            match serde_json::from_str::<ChatResponse>(buffer.trim()) {
                Ok(response) => {
                    on_chunk(response);
                }
                Err(error) => {
                    eprintln!("Failed to parse trailing chunk: {} - {}", buffer, error);
                }
            }
        }

        Ok(())
    }

    pub async fn pull_model(&self, name: &str) -> Result<(), String> {
        self.pull_model_stream(name, |_| {}).await
    }

    pub async fn pull_model_stream<F>(&self, name: &str, mut on_progress: F) -> Result<(), String>
    where
        F: FnMut(EnginePullProgress) + Send,
    {
        let response = self
            .client
            .post(format!("{}/api/pull", self.base_url))
            .json(&serde_json::json!({ "name": name, "stream": true }))
            .send()
            .await
            .map_err(|error| format!("Request failed: {}", error))?;

        if !response.status().is_success() {
            return Err(format!("Pull failed: {}", response.status()));
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("Stream error: {}", error))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.trim().is_empty() {
                    continue;
                }

                let progress = serde_json::from_str::<EnginePullProgress>(line.trim())
                    .map_err(|error| format!("Failed to parse pull progress: {}", error))
                    .map(|progress| normalize_pull_progress(name, progress))?;

                let is_done = progress.done;
                on_progress(progress);

                if is_done {
                    return Ok(());
                }
            }
        }

        if !buffer.trim().is_empty() {
            let progress = serde_json::from_str::<EnginePullProgress>(buffer.trim())
                .map_err(|error| format!("Failed to parse final pull progress: {}", error))
                .map(|progress| normalize_pull_progress(name, progress))?;

            on_progress(progress);
        }

        Ok(())
    }

    pub async fn delete_model(&self, name: &str) -> Result<(), String> {
        let response = self
            .client
            .delete(format!("{}/api/delete", self.base_url))
            .json(&serde_json::json!({ "name": name }))
            .send()
            .await
            .map_err(|error| format!("Request failed: {}", error))?;

        if !response.status().is_success() {
            return Err(format!("Delete failed: {}", response.status()));
        }

        Ok(())
    }

    fn prepare_messages_for_request(
        &self,
        messages: Vec<ChatMessage>,
    ) -> Result<Vec<ChatMessage>, String> {
        messages
            .into_iter()
            .map(|message| {
                if message.images.is_empty() {
                    return Ok(message);
                }

                let images = message
                    .images
                    .iter()
                    .map(|path| {
                        std::fs::read(path)
                            .map(|bytes| STANDARD.encode(bytes))
                            .map_err(|error| format!("Failed to read image {}: {}", path, error))
                    })
                    .collect::<Result<Vec<_>, _>>()?;

                Ok(ChatMessage { images, ..message })
            })
            .collect()
    }
}

fn normalize_pull_progress(name: &str, mut progress: EnginePullProgress) -> EnginePullProgress {
    progress.model = name.to_string();
    progress.done = progress.done || progress.status.eq_ignore_ascii_case("success");
    progress
}
