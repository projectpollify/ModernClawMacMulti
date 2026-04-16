import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage } from '@/services/engine';

export interface ContextStats {
  system_tokens: number;
  history_tokens: number;
  total_tokens: number;
  max_tokens: number;
  messages_included: number;
  messages_truncated: number;
  usage_percent: number;
}

export interface BuildContextResponse {
  messages: ChatMessage[];
  stats: ContextStats;
}

export const contextApi = {
  async buildContext(
    conversationHistory: ChatMessage[],
    userMessage: ChatMessage,
    maxTokens = 4096
  ): Promise<BuildContextResponse> {
    return invoke('build_context', {
      conversationHistory,
      userMessage,
      maxTokens,
    });
  },
};
