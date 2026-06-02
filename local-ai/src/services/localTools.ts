import { invoke } from '@tauri-apps/api/core';

export interface LocalToolResult {
  name: string;
  success: boolean;
  content: unknown;
}

export const localToolsApi = {
  async execute(name: string, argumentsValue: Record<string, unknown> = {}): Promise<LocalToolResult> {
    return invoke('local_tool_execute', { name, arguments: argumentsValue });
  },
};
