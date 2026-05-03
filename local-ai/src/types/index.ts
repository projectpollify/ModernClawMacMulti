export type ViewType = 'chat' | 'memory' | 'brain' | 'setup' | 'settings';
export type Theme = 'light' | 'dark' | 'system';

export interface Agent {
  agentId: string;
  name: string;
  profileKind?: 'main' | 'support' | 'custom';
  sharesPrimaryWorkspace?: boolean;
  description?: string;
  status?: string;
  workspacePath?: string;
  defaultModel?: string;
  enableVoiceOutput?: boolean;
  piperVoicePreset?: string;
  piperModelPath?: string;
  enableVoiceInput?: boolean;
  whisperModelPath?: string;
  whisperLanguage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AgentVoiceSettings {
  enableVoiceOutput?: boolean;
  piperVoicePreset?: string;
  piperModelPath?: string;
  enableVoiceInput?: boolean;
  whisperModelPath?: string;
  whisperLanguage?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  conversationId: string;
  attachments?: MessageAttachment[];
  tokensUsed?: number;
  metrics?: MessageMetrics;
  feedback?: 'up' | 'down';
  feedbackNote?: string;
}

export interface MessageContextStats {
  systemTokens: number;
  historyTokens: number;
  totalTokens: number;
  maxTokens: number;
  messagesIncluded: number;
  messagesTruncated: number;
  usagePercent: number;
}

export interface MessageMetrics {
  model?: string;
  promptTokens?: number;
  outputTokens?: number;
  totalDurationMs?: number;
  tokensPerSecond?: number;
  finishReason?: string;
  context?: MessageContextStats;
}

export interface MessageAttachment {
  id: string;
  kind: 'image' | 'audio' | 'document';
  name: string;
  path: string;
  mimeType?: string;
  sizeBytes?: number;
  extractedText?: string;
}

export interface AudioNoteDraft {
  file: File;
  transcript: string;
  mimeType?: string;
}

export interface DocumentAttachmentDraft {
  file: File;
  extractedText: string;
  mimeType?: string;
}

export interface MessageFeedbackSummary {
  assistantMessageCount: number;
  ratedCount: number;
  helpfulCount: number;
  notUsefulCount: number;
}

export interface Conversation {
  id: string;
  agentId?: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  model: string;
  messageCount: number;
  preview?: string;
}

export type SuggestionKind = 'profile' | 'memory' | 'knowledge' | 'behavior';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'deferred';
export type BrainActivityAction =
  | 'accepted'
  | 'deferred'
  | 'dismissed'
  | 'returned'
  | 'knowledge_saved'
  | 'setup_applied'
  | 'curator_imported'
  | 'curator_rejected';

export interface BrainSuggestion {
  id: string;
  title: string;
  summary: string;
  kind: SuggestionKind;
  target: string;
  reason: string;
  status: SuggestionStatus;
  createdAt: string;
  proposedContent?: string;
  questionPrompt?: string;
}

export interface BrainActivityEntry {
  id: string;
  suggestionId?: string;
  title: string;
  action: BrainActivityAction;
  detail: string;
  createdAt: string;
}

export interface KnowledgeIntakeRecord {
  id: string;
  filename: string;
  title: string;
  source?: string;
  summary?: string;
  tags: string[];
  createdAt: string;
}

export interface CuratorPackage {
  id: string;
  folderName: string;
  title: string;
  summary?: string;
  source?: string;
  tags: string[];
  requestTopic?: string;
  createdAt?: string;
  status: string;
  path: string;
}
