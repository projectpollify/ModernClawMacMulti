import { contextApi } from '@/services/context';
import type { ChatMessage } from '@/services/engine';

export function useContextBuilder() {
  const buildContext = async (
    conversationHistory: ChatMessage[],
    userMessage: ChatMessage,
    maxTokens?: number
  ) => contextApi.buildContext(conversationHistory, userMessage, maxTokens);

  return { buildContext };
}
