import { invoke } from '@tauri-apps/api/core';
import type { MessageAttachment } from '@/types';

interface StoreAttachmentInput {
  conversationId: string;
  filename: string;
  kind: 'image' | 'audio' | 'document';
  mimeType?: string;
  bytes: Uint8Array;
  extractedText?: string;
}

export const attachmentApi = {
  async storeAttachment(input: StoreAttachmentInput): Promise<MessageAttachment> {
    return invoke<MessageAttachment>('memory_store_chat_attachment', {
      conversationId: input.conversationId,
      filename: input.filename,
      kind: input.kind,
      mimeType: input.mimeType ?? null,
      extractedText: input.extractedText ?? null,
      bytes: Array.from(input.bytes),
    });
  },
};
