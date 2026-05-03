import { MessageBubble } from './MessageBubble';
import { StreamingBubble } from './StreamingBubble';
import { TypingIndicator } from './TypingIndicator';
import { useChatStore } from '@/stores/chatStore';
import type { Message } from '@/types';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const { isStreaming, streamingContent, streamingMetrics } = useChatStore();
  const showStreamingBubble = isStreaming || (isLoading && Boolean(streamingMetrics));

  return (
    <div className="mx-auto flex w-full max-w-[58rem] flex-col gap-7 px-2 py-2">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {showStreamingBubble ? <StreamingBubble content={streamingContent} metrics={streamingMetrics} /> : null}
      {isLoading && !showStreamingBubble && <TypingIndicator />}
    </div>
  );
}
