import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface Model {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

export interface ChatResponse {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
  finish_reason?: string;
}

export interface EngineStatus {
  running: boolean;
  version?: string;
  error?: string;
}

export interface ModelPullProgress {
  model: string;
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  done: boolean;
}

export const engineApi = {
  async checkStatus(): Promise<EngineStatus> {
    return invoke('check_engine_status');
  },

  async listModels(): Promise<Model[]> {
    return invoke('list_models');
  },

  async sendMessage(
    model: string,
    messages: ChatMessage[],
    conversationId: string,
    onChunk: (chunk: ChatResponse) => void
  ): Promise<void> {
    const unlisten = await listen<ChatResponse>(`chat-chunk-${conversationId}`, (event) => {
      onChunk(event.payload);
    });

    try {
      await invoke('chat_send', { model, messages, conversationId });
    } finally {
      unlisten();
    }
  },

  async pullModel(name: string, onProgress?: (progress: ModelPullProgress) => void): Promise<void> {
    const unlisten = onProgress
      ? await listen<ModelPullProgress>('model-pull-progress', (event) => {
          if (event.payload.model === name) {
            onProgress(event.payload);
          }
        })
      : null;

    try {
      return await invoke('pull_model', { name });
    } finally {
      if (unlisten) {
        unlisten();
      }
    }
  },

  async deleteModel(name: string): Promise<void> {
    return invoke('delete_model', { name });
  },
};
