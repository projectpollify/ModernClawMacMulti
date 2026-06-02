use crate::services::local_tools::LocalToolService;
use crate::types::{ChatMessage, ContextStats, MemoryContext};

fn estimate_tokens(text: &str) -> usize {
    text.chars().count() / 4
}

fn push_section(parts: &mut Vec<String>, heading: Option<&str>, content: &str) {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return;
    }

    match heading {
        Some(title) => parts.push(format!("## {}\n\n{}", title, trimmed)),
        None => parts.push(trimmed.to_string()),
    }
}

fn build_system_prompt(context: &MemoryContext) -> String {
    let mut parts = Vec::new();

    parts.push(
        [
            "You are the currently selected ModernClaw brain for this conversation.",
            "Adopt the identity, tone, priorities, and behavior described in SOUL.md as your active persona.",
            "Treat USER.md as factual context about the human you are helping, and MEMORY.md plus today's context as working memory.",
            "Do not describe SOUL.md as an external file you merely read unless the user explicitly asks about prompt construction.",
            "Do not fall back to generic model self-descriptions like 'I am Gemma' or 'I am a language model from Google' unless the user explicitly asks about the underlying model runtime.",
            "When the brain persona gives you a name or role, answer consistently from that identity.",
            LocalToolService::tool_instructions(),
        ]
        .join(" "),
    );

    if let Some(soul) = &context.soul {
        push_section(&mut parts, Some("SOUL Instructions"), soul);
    }

    if let Some(user) = &context.user {
        push_section(&mut parts, Some("About the User"), user);
    }

    if let Some(memory) = &context.memory {
        push_section(&mut parts, Some("Long-Term Memory"), memory);
    }

    if let Some(today_log) = &context.today_log {
        push_section(&mut parts, Some("Today's Context"), today_log);
    }

    for (index, knowledge) in context.knowledge_files.iter().enumerate() {
        push_section(
            &mut parts,
            Some(&format!("Knowledge Reference {}", index + 1)),
            knowledge,
        );
    }

    parts.join("\n\n---\n\n")
}

pub struct ContextBuilder {
    max_context_tokens: usize,
    reserved_for_response: usize,
}

impl ContextBuilder {
    pub fn new(max_context_tokens: usize) -> Self {
        let max_context_tokens = max_context_tokens.max(512);

        Self {
            max_context_tokens,
            reserved_for_response: max_context_tokens / 4,
        }
    }

    pub fn build(
        &self,
        memory_context: &MemoryContext,
        conversation_history: &[ChatMessage],
        user_message: &ChatMessage,
    ) -> Vec<ChatMessage> {
        self.build_with_stats(memory_context, conversation_history, user_message)
            .0
    }

    pub fn build_with_stats(
        &self,
        memory_context: &MemoryContext,
        conversation_history: &[ChatMessage],
        user_message: &ChatMessage,
    ) -> (Vec<ChatMessage>, ContextStats) {
        let mut messages = Vec::new();
        let available_tokens = self
            .max_context_tokens
            .saturating_sub(self.reserved_for_response);

        let system_prompt = build_system_prompt(memory_context);
        let system_tokens = estimate_tokens(&system_prompt);

        if !system_prompt.is_empty() {
            messages.push(ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
                images: Vec::new(),
            });
        }

        let user_message_tokens = estimate_tokens(&user_message.content);
        let remaining_for_history = available_tokens
            .saturating_sub(system_tokens)
            .saturating_sub(user_message_tokens)
            .saturating_sub(100);

        let mut history_messages = Vec::new();
        let mut history_tokens = 0;

        for message in conversation_history.iter().rev() {
            let message_tokens = estimate_tokens(&message.content);
            if history_tokens + message_tokens > remaining_for_history {
                break;
            }

            history_tokens += message_tokens;
            history_messages.push(message.clone());
        }

        history_messages.reverse();
        let included_history_count = history_messages.len();
        messages.extend(history_messages);
        messages.push(user_message.clone());

        let total_tokens = system_tokens + history_tokens + user_message_tokens;
        let usage_percent = if self.max_context_tokens == 0 {
            0.0
        } else {
            (total_tokens as f32 / self.max_context_tokens as f32) * 100.0
        };

        let stats = ContextStats {
            system_tokens,
            history_tokens: history_tokens + user_message_tokens,
            total_tokens,
            max_tokens: self.max_context_tokens,
            messages_included: included_history_count + 1,
            messages_truncated: conversation_history
                .len()
                .saturating_sub(included_history_count),
            usage_percent,
        };

        (messages, stats)
    }
}
