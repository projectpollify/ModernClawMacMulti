import { create } from 'zustand';
import { attachmentApi } from '@/services/attachments';
import type { AudioNoteDraft, Message } from '@/types';
import { generateTitleFromMessage } from '@/lib/generateTitle';
import { IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_NAME, MODEL_PROVIDER_STATUS_URL } from '@/lib/providerConfig';
import { DEFAULT_FLOOR_MODEL } from '@/lib/voiceCatalog';
import { contextApi, type ContextStats } from '@/services/context';
import { historyApi } from '@/services/history';
import { ollamaApi, type ChatMessage, type ChatResponse } from '@/services/ollama';
import { useConversationStore } from '@/stores/conversationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MessageContextStats, MessageMetrics } from '@/types';

interface ChatState {
  messages: Message[];
  messagesByConversation: Record<string, Message[]>;
  isLoading: boolean;
  isStreaming: boolean;
  currentModel: string | null;
  currentConversationId: string | null;
  streamingContent: string;
  streamingMetrics: MessageMetrics | null;
  error: string | null;
  sendMessage: (content: string, imageFiles?: File[], audioNotes?: AudioNoteDraft[]) => Promise<void>;
  setMessageFeedback: (messageId: string, feedback?: 'up' | 'down', feedbackNote?: string) => Promise<void>;
  setModel: (model: string) => void;
  newConversation: (conversationId: string) => void;
  loadConversation: (id: string, messages?: Message[]) => void;
  deleteConversationMessages: (id: string) => void;
  clearError: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  messagesByConversation: {},
  isLoading: false,
  isStreaming: false,
  currentModel: DEFAULT_FLOOR_MODEL,
  currentConversationId: null,
  streamingContent: '',
  streamingMetrics: null,
  error: null,

  sendMessage: async (content: string, imageFiles: File[] = [], audioNotes: AudioNoteDraft[] = []) => {
    const { currentModel, messages, currentConversationId } = get();
    const appSettings = useSettingsStore.getState().settings;
    const trimmedContent = content.trim();
    const normalizedAudioNotes = audioNotes
      .map((note) => ({
        ...note,
        transcript: note.transcript.trim(),
      }))
      .filter((note) => note.transcript);

    if (!currentModel) {
      set({ error: 'No model selected' });
      return;
    }

    if (!trimmedContent && imageFiles.length === 0 && normalizedAudioNotes.length === 0) {
      return;
    }

    const conversationStore = useConversationStore.getState();
    let conversationId = currentConversationId ?? conversationStore.currentId;

    if (!conversationId) {
      conversationId = await conversationStore.createConversation(currentModel);
    }

    const attachments = await Promise.all([
      ...imageFiles.map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return attachmentApi.storeAttachment({
          conversationId,
          filename: file.name,
          kind: 'image',
          mimeType: file.type,
          bytes,
        });
      }),
      ...normalizedAudioNotes.map(async (note) => {
        const bytes = new Uint8Array(await note.file.arrayBuffer());
        return attachmentApi.storeAttachment({
          conversationId,
          filename: note.file.name,
          kind: 'audio',
          mimeType: note.mimeType ?? note.file.type,
          bytes,
        });
      }),
    ]);

    const userContent = buildUserMessageContent(trimmedContent, normalizedAudioNotes);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      createdAt: new Date(),
      conversationId,
      attachments,
    };

    const nextMessages = [...messages, userMessage];

    const syncConversationState = async (items: Message[]) => {
      const currentConversation = useConversationStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId);
      const firstUserMessage = items.find((message) => message.role === 'user');

      await useConversationStore.getState().updateConversation(conversationId, {
        model: currentModel,
        messageCount: items.length,
        title:
          currentConversation?.title === 'New Chat' && firstUserMessage
            ? generateTitleFromMessage(firstUserMessage.content || firstUserMessage.attachments?.[0]?.name || 'Image request')
            : currentConversation?.title ?? 'New Chat',
        preview:
          firstUserMessage?.content.slice(0, 100) ||
          (firstUserMessage?.attachments?.length ? `[${firstUserMessage.attachments.length} attachment${firstUserMessage.attachments.length === 1 ? '' : 's'}]` : undefined),
      });
    };

    set((state) => ({
      messages: nextMessages,
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: nextMessages,
      },
      isLoading: true,
      isStreaming: false,
      currentConversationId: conversationId,
      streamingContent: '',
      streamingMetrics: null,
      error: null,
    }));

    const assistantMessageId = crypto.randomUUID();
    let finalizedAssistantMessage: Message | null = null;
    let fullContent = '';
    let didCompleteStream = false;
    let responseMetrics: MessageMetrics | null = null;

    const isConversationVisible = () => get().currentConversationId === conversationId;

    const finalizeAssistantMessage = (errorMessage: string | null = null) => {
      if (!fullContent.trim()) {
        if (isConversationVisible()) {
          set({
            isLoading: false,
            isStreaming: false,
            streamingContent: '',
            streamingMetrics: null,
            error: errorMessage ?? `No response received from ${MODEL_PROVIDER_NAME}.`,
          });
        }
        return;
      }

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: fullContent,
        createdAt: new Date(),
        conversationId,
        tokensUsed: responseMetrics?.outputTokens ?? estimateTokens(fullContent),
        metrics: responseMetrics ?? undefined,
      };

      finalizedAssistantMessage = assistantMessage;

      set((state) => {
        const existingConversationMessages = state.messagesByConversation[conversationId] ?? nextMessages;
        const updatedConversationMessages = [...existingConversationMessages, assistantMessage];
        const nextState: Partial<ChatState> = {
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: updatedConversationMessages,
          },
        };

        if (state.currentConversationId === conversationId) {
          nextState.messages = updatedConversationMessages;
          nextState.isLoading = false;
          nextState.isStreaming = false;
          nextState.streamingContent = '';
          nextState.streamingMetrics = null;
          nextState.error = errorMessage;
        }

        return nextState as ChatState;
      });
    };

    try {
      if (appSettings.saveConversationHistory) {
        await historyApi.createMessage(userMessage);
      }
      await syncConversationState(nextMessages);

      const conversationHistory: ChatMessage[] = messages.map(toChatMessage);
      const { messages: contextMessages, stats } = await contextApi.buildContext(
        conversationHistory,
        toChatMessage(userMessage),
        appSettings.contextWindowSize
      );
      responseMetrics = {
        model: currentModel,
        context: mapContextStats(stats),
      };
      if (isConversationVisible()) {
        set({ streamingMetrics: responseMetrics });
      }

      await ollamaApi.sendMessage(
        currentModel,
        contextMessages,
        conversationId,
        (chunk: ChatResponse) => {
          responseMetrics = mergeResponseMetrics(responseMetrics, chunk, fullContent);
          if (chunk.message?.content) {
            fullContent += chunk.message.content;
            if (appSettings.streamResponses && isConversationVisible()) {
              set({
                streamingContent: fullContent,
                isStreaming: true,
                streamingMetrics: responseMetrics,
              });
            }
          }

          if (chunk.done) {
            responseMetrics = finalizeResponseMetrics(responseMetrics, fullContent);
            didCompleteStream = true;
            finalizeAssistantMessage();
          }
        }
      );

      if (!didCompleteStream) {
        finalizeAssistantMessage('Response stream ended unexpectedly.');
      }

      if (finalizedAssistantMessage) {
        if (appSettings.saveConversationHistory) {
          await historyApi.createMessage(finalizedAssistantMessage);
        }
        await syncConversationState(get().messagesByConversation[conversationId] ?? []);
      }
    } catch (error) {
      if (fullContent.trim()) {
        finalizeAssistantMessage(`Response interrupted. Partial answer was saved. (${String(error)})`);

        if (finalizedAssistantMessage && appSettings.saveConversationHistory) {
          await historyApi.createMessage(finalizedAssistantMessage);
        }

        await syncConversationState(get().messagesByConversation[conversationId] ?? []);
        return;
      }

      if (isConversationVisible()) {
        set({
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
          streamingMetrics: null,
          error: normalizeChatError(error),
        });
      }
    }
  },

  setMessageFeedback: async (messageId: string, feedback, feedbackNote) => {
    const updateMessages = (items: Message[]) =>
      items.map((message) =>
        message.id === messageId
          ? {
              ...message,
              feedback,
              feedbackNote: feedback === 'down' ? feedbackNote ?? message.feedbackNote : undefined,
            }
          : message
      );

    const { currentConversationId } = get();
    const conversationId = Object.entries(get().messagesByConversation).find(([, items]) =>
      items.some((message) => message.id === messageId)
    )?.[0];

    if (!conversationId) {
      return;
    }

    const previousMessages = get().messagesByConversation[conversationId] ?? [];
    const nextConversationMessages = updateMessages(previousMessages);

    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: nextConversationMessages,
      },
      ...(state.currentConversationId === conversationId
        ? {
            messages: updateMessages(state.messages),
          }
        : {}),
    }));

    try {
      await historyApi.setMessageFeedback(messageId, feedback, feedback === 'down' ? feedbackNote : undefined);
    } catch (error) {
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: previousMessages,
        },
        ...(currentConversationId === conversationId
          ? {
              messages: previousMessages,
              error: `Unable to save feedback. (${String(error)})`,
            }
          : {}),
      }));
    }
  },

  setModel: (model: string) => {
    set({ currentModel: model });
  },

  newConversation: (conversationId: string) => {
    set({
      messages: [],
      currentConversationId: conversationId,
      streamingContent: '',
      streamingMetrics: null,
      error: null,
      isLoading: false,
      isStreaming: false,
    });
  },

  loadConversation: (id: string, messages = get().messagesByConversation[id] ?? []) => {
    set({
      currentConversationId: id,
      messages,
      messagesByConversation: {
        ...get().messagesByConversation,
        [id]: messages,
      },
      streamingContent: '',
      streamingMetrics: null,
      error: null,
      isLoading: false,
      isStreaming: false,
    });
  },

  deleteConversationMessages: (id: string) =>
    set((state) => {
      const nextMessagesByConversation = { ...state.messagesByConversation };
      delete nextMessagesByConversation[id];

      return {
        messagesByConversation: nextMessagesByConversation,
        ...(state.currentConversationId === id
          ? {
              currentConversationId: null,
              messages: [],
              streamingContent: '',
              streamingMetrics: null,
              isLoading: false,
              isStreaming: false,
            }
          : {}),
      };
    }),

  clearError: () => set({ error: null }),

  clearMessages: () =>
    set({
      messages: [],
      messagesByConversation: {},
      currentConversationId: null,
      streamingContent: '',
      streamingMetrics: null,
      error: null,
      isLoading: false,
      isStreaming: false,
    }),
}));

function normalizeChatError(error: unknown): string {
  const rawError = String(error);
  const normalized = rawError.toLowerCase();

  if (normalized.includes('model failed to load')) {
    return (
      `${MODEL_PROVIDER_NAME} is responding, but its model runner crashed while loading the model. ` +
      `This points to a ${MODEL_PROVIDER_NAME} runtime problem on this machine rather than ModernClaw request wiring. ` +
      (IS_MAC_MODEL_PROVIDER
        ? 'Check the llama.cpp console output, then retry after the engine finishes reloading the model.'
        : 'Check ~/.ollama/logs/server.log, then update or reinstall Ollama before retrying.')
    );
  }

  if (
    normalized.includes('connection refused') ||
    normalized.includes("couldn't connect") ||
    normalized.includes('failed to connect')
  ) {
    return (
      `ModernClaw could not reach ${MODEL_PROVIDER_NAME} on ${MODEL_PROVIDER_STATUS_URL}. ` +
      (IS_MAC_MODEL_PROVIDER
        ? 'Start the local llama.cpp engine on port 8080, make sure a model is loaded, and refresh the checks.'
        : 'Start Ollama first, or use the Setup screen to launch it and refresh the checks.')
    );
  }

  return rawError;
}

function toChatMessage(message: Message): ChatMessage {
  return {
    role: message.role,
    content: message.content,
    images:
      message.attachments
        ?.filter((attachment) => attachment.kind === 'image')
        .map((attachment) => attachment.path) ?? [],
  };
}

function buildUserMessageContent(content: string, audioNotes: AudioNoteDraft[]): string {
  if (audioNotes.length === 0) {
    return content;
  }

  const transcriptSections = audioNotes
    .map((note, index) => `Audio note ${index + 1} transcript:\n${note.transcript}`)
    .join('\n\n');

  return content ? `${content}\n\n${transcriptSections}` : transcriptSections;
}

function mapContextStats(stats: ContextStats): MessageContextStats {
  return {
    systemTokens: stats.system_tokens,
    historyTokens: stats.history_tokens,
    totalTokens: stats.total_tokens,
    maxTokens: stats.max_tokens,
    messagesIncluded: stats.messages_included,
    messagesTruncated: stats.messages_truncated,
    usagePercent: stats.usage_percent,
  };
}

function mergeResponseMetrics(
  current: MessageMetrics | null,
  chunk: ChatResponse,
  fullContentBeforeChunk: string
): MessageMetrics {
  const merged: MessageMetrics = {
    ...(current ?? {}),
    model: chunk.model || current?.model,
    promptTokens: chunk.prompt_eval_count ?? current?.promptTokens,
    outputTokens: chunk.eval_count ?? current?.outputTokens,
    totalDurationMs: normalizeDuration(chunk.total_duration) ?? current?.totalDurationMs,
    finishReason: chunk.finish_reason ?? current?.finishReason,
  };

  const completedContent = fullContentBeforeChunk + (chunk.message?.content ?? '');

  if (!merged.outputTokens && completedContent.trim()) {
    merged.outputTokens = estimateTokens(completedContent);
  }

  if (merged.outputTokens && merged.totalDurationMs && merged.totalDurationMs > 0) {
    merged.tokensPerSecond = merged.outputTokens / (merged.totalDurationMs / 1000);
  }

  return merged;
}

function finalizeResponseMetrics(current: MessageMetrics | null, content: string): MessageMetrics | null {
  if (!current && !content.trim()) {
    return null;
  }

  const finalized: MessageMetrics = {
    ...(current ?? {}),
  };

  if (!finalized.outputTokens && content.trim()) {
    finalized.outputTokens = estimateTokens(content);
  }

  if (finalized.outputTokens && finalized.totalDurationMs && finalized.totalDurationMs > 0) {
    finalized.tokensPerSecond = finalized.outputTokens / (finalized.totalDurationMs / 1000);
  }

  return finalized;
}

function normalizeDuration(rawDuration: number | undefined) {
  if (!rawDuration || rawDuration <= 0) {
    return undefined;
  }

  return rawDuration >= 1_000_000 ? rawDuration / 1_000_000 : rawDuration;
}

function estimateTokens(content: string) {
  return Math.max(1, Math.ceil(content.length / 4));
}
