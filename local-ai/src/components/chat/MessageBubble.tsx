import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { MessageContent } from './MessageContent';
import { MessageMetricsRow } from './MessageMetricsRow';
import type { Message } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';
import { useVoiceStore } from '@/stores/voiceStore';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const setMessageFeedback = useChatStore((state) => state.setMessageFeedback);
  const { showTokenCount, showResponseMetrics, enableVoiceOutput } = useSettingsStore((state) => state.settings);
  const { speakMessage, isSpeaking, isPaused, speakingMessageId } = useVoiceStore();
  const tokenCount = estimateTokens(message.content);
  const messageMetrics =
    message.metrics ??
    (message.tokensUsed
      ? {
          outputTokens: message.tokensUsed,
        }
      : undefined);
  const isActiveMessage = speakingMessageId === message.id;
  const [isFeedbackNoteOpen, setIsFeedbackNoteOpen] = useState(message.feedback === 'down');
  const [feedbackDraft, setFeedbackDraft] = useState(message.feedbackNote ?? '');

  useEffect(() => {
    setFeedbackDraft(message.feedbackNote ?? '');
    setIsFeedbackNoteOpen(message.feedback === 'down' && Boolean((message.feedbackNote ?? '').trim()) ? true : message.feedback === 'down');
  }, [message.feedback, message.feedbackNote]);

  const handleHelpfulClick = () => {
    const nextFeedback = message.feedback === 'up' ? undefined : 'up';
    setIsFeedbackNoteOpen(false);
    setFeedbackDraft('');
    void setMessageFeedback(message.id, nextFeedback);
  };

  const handleNotUsefulClick = () => {
    if (message.feedback === 'down') {
      setIsFeedbackNoteOpen(false);
      setFeedbackDraft('');
      void setMessageFeedback(message.id, undefined);
      return;
    }

    setIsFeedbackNoteOpen(true);
    void setMessageFeedback(message.id, 'down', message.feedbackNote);
  };

  const submitFeedbackNote = () => {
    void setMessageFeedback(message.id, 'down', feedbackDraft.trim());
    setIsFeedbackNoteOpen(false);
  };

  return (
    <div className={cn('flex gap-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.2rem] text-sm font-semibold shadow-[var(--surface-shadow-soft)]',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border/80 bg-[hsl(var(--panel-strong))] text-secondary-foreground'
        )}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      <div
        className={cn(
          'max-w-[80%] rounded-[1.65rem] border px-5 py-4 shadow-[var(--surface-shadow-soft)] backdrop-blur-[18px]',
          isUser
            ? 'rounded-tr-[0.5rem] border-primary/15 bg-primary text-primary-foreground'
            : 'rounded-tl-[0.5rem] border-border/70 bg-[hsl(var(--panel-strong))] text-secondary-foreground'
        )}
      >
        {message.attachments?.some((attachment) => attachment.kind === 'image') ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {message.attachments
              .filter((attachment) => attachment.kind === 'image')
              .map((attachment) => (
                <a
                  key={attachment.id}
                  href={convertFileSrc(attachment.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-2xl border border-black/10 bg-black/5 shadow-[var(--surface-shadow-soft)]"
                >
                  <img
                    src={convertFileSrc(attachment.path)}
                    alt={attachment.name}
                    className="max-h-72 w-full object-cover"
                  />
                </a>
              ))}
          </div>
        ) : null}
        {message.attachments?.some((attachment) => attachment.kind === 'audio') ? (
          <div className="mb-3 space-y-2">
            {message.attachments
              .filter((attachment) => attachment.kind === 'audio')
              .map((attachment) => (
                <div key={attachment.id} className="rounded-2xl border border-black/10 bg-black/5 p-3">
                  <p className="mb-2 text-xs font-medium opacity-75">{attachment.name}</p>
                  <audio controls preload="metadata" className="w-full" src={convertFileSrc(attachment.path)} />
                </div>
              ))}
          </div>
        ) : null}
        {message.attachments?.some((attachment) => attachment.kind === 'document') ? (
          <div className="mb-3 space-y-2">
            {message.attachments
              .filter((attachment) => attachment.kind === 'document')
              .map((attachment) => (
                <a
                  key={attachment.id}
                  href={convertFileSrc(attachment.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-black/10 bg-black/5 p-3 transition-colors hover:bg-black/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-65">Document</p>
                      <p className="mt-1 truncate text-sm font-medium">{attachment.name}</p>
                      {attachment.extractedText ? (
                        <p className="mt-1 line-clamp-3 text-xs opacity-75">{attachment.extractedText}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs opacity-60">Open</span>
                  </div>
                </a>
              ))}
          </div>
        ) : null}
        <MessageContent content={message.content} />
        {isAssistant && showResponseMetrics ? <MessageMetricsRow metrics={messageMetrics} /> : null}
        <div
          className={cn(
            'mt-3 flex items-center gap-2 text-xs opacity-70',
            isUser ? 'justify-end text-right' : 'justify-start text-left'
          )}
        >
          <span>
            {formatTime(message.createdAt)}
            {showTokenCount ? ` | ~${tokenCount} tokens` : ''}
          </span>
          {isAssistant ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mark response helpful"
                title="Helpful"
                onClick={handleHelpfulClick}
                className={cn(
                  'rounded-md px-1.5 py-1 transition-colors',
                  message.feedback === 'up'
                    ? 'bg-emerald-500/15 text-emerald-700'
                    : 'hover:bg-background/50'
                )}
              >
                <ThumbUpIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Mark response not useful"
                title="Not useful"
                onClick={handleNotUsefulClick}
                className={cn(
                  'rounded-md px-1.5 py-1 transition-colors',
                  message.feedback === 'down'
                    ? 'bg-rose-500/15 text-rose-700'
                    : 'hover:bg-background/50'
                )}
              >
                <ThumbDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          {isAssistant && enableVoiceOutput ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] opacity-90"
              onClick={() => void speakMessage(message.id, message.content)}
            >
              {isActiveMessage
                ? isPaused
                  ? 'Resume Reading'
                  : 'Pause Reading'
                : isSpeaking
                  ? 'Read Instead'
                  : 'Read Aloud'}
            </Button>
          ) : null}
        </div>
        {isAssistant && message.feedback === 'down' && isFeedbackNoteOpen ? (
          <div className="mt-4 rounded-[1.4rem] border border-border/80 bg-background/55 p-3 text-foreground">
            <label className="block text-xs font-medium text-muted-foreground" htmlFor={`feedback-note-${message.id}`}>
              What was wrong?
            </label>
            <textarea
              id={`feedback-note-${message.id}`}
              value={feedbackDraft}
              onChange={(event) => setFeedbackDraft(event.target.value.slice(0, 240))}
              placeholder="Too vague, wrong tone, bad format, missed the point..."
              className="mt-2 min-h-[78px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{240 - feedbackDraft.length} left</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md px-2.5 py-1 hover:bg-background/80"
                  onClick={() => {
                    setFeedbackDraft(message.feedbackNote ?? '');
                    setIsFeedbackNoteOpen(false);
                  }}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground hover:opacity-95"
                  onClick={submitFeedbackNote}
                >
                  Save note
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {isAssistant && message.feedback === 'down' && !isFeedbackNoteOpen && message.feedbackNote ? (
          <div className="mt-4 rounded-[1.2rem] border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/85">Feedback note:</span> {message.feedbackNote}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatTime(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function estimateTokens(content: string) {
  return Math.max(1, Math.ceil(content.length / 4));
}

function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 9V5a3 3 0 00-3-3l-1 4-3 4v10h11.28a2 2 0 001.96-1.61l1.39-7A2 2 0 0019.67 9H14zM7 22H4a1 1 0 01-1-1v-9a1 1 0 011-1h3"
      />
    </svg>
  );
}

function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 15v4a3 3 0 003 3l1-4 3-4V4H5.72a2 2 0 00-1.96 1.61l-1.39 7A2 2 0 004.33 15H10zm7-13h3a1 1 0 011 1v9a1 1 0 01-1 1h-3"
      />
    </svg>
  );
}
