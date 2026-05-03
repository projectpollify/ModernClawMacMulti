import { useEffect, useRef } from 'react';
import { ErrorBanner } from './ErrorBanner';
import { EmptyState } from './EmptyState';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { SetupAttentionBanner } from './SetupAttentionBanner';
import { useChatStore } from '@/stores/chatStore';

export function ChatView() {
  const { messages, isLoading, streamingContent } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: isLoading || Boolean(streamingContent) ? 'auto' : 'smooth',
    });
  }, [messages, isLoading, streamingContent]);

  return (
    <div className="flex h-full flex-col">
      <SetupAttentionBanner />
      <ErrorBanner />
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4 pt-5">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <MessageList messages={messages} isLoading={isLoading} />
        )}
      </div>

      <div className="border-t border-border/60 bg-[hsl(var(--panel))] px-5 py-4 backdrop-blur-[18px]">
        <MessageInput />
      </div>
    </div>
  );
}
