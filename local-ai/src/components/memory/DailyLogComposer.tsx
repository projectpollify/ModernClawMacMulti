import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatCharacterRange, formatSoftLimit, getContentGuidance, getLengthState } from '@/lib/contentGuidance';
import { useAgentStore } from '@/stores/agentStore';
import { useMemoryStore } from '@/stores/memoryStore';

interface DailyLogComposerProps {
  onClose: () => void;
  onSaved: (date: string) => void;
}

export function DailyLogComposer({ onClose, onSaved }: DailyLogComposerProps) {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const appendDailyLog = useMemoryStore((state) => state.appendDailyLog);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => getLocalDateString(), []);
  const guidance = getContentGuidance('daily-log');
  const brainName = activeAgent?.name ?? 'this brain';

  const trimmedContent = content.trim();
  const hasContent = trimmedContent.length > 0;
  const wordCount = trimmedContent.split(/\s+/).filter(Boolean).length;
  const lengthState = getLengthState(trimmedContent.length, guidance);

  useEffect(() => {
    setContent('');
    setError(null);
    setIsSaving(false);
  }, [activeAgent?.agentId]);

  const handleSave = async () => {
    if (!hasContent) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await appendDailyLog(trimmedContent);
      onSaved(today);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasContent && !window.confirm('Discard this daily log entry?')) {
      return;
    }

    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void handleSave();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasContent, trimmedContent, activeAgent?.agentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex h-[min(78vh,700px)] w-full max-w-3xl flex-col rounded-[32px] border border-border bg-background shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">New Daily Log Entry</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This adds an entry to <code className="rounded bg-secondary px-1.5 py-0.5">memory/{today}.md</code>{' '}
              for {brainName} and makes it available as today&apos;s context in chat.
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Recommended length: {formatCharacterRange(guidance)}. Soft limit: {formatSoftLimit(guidance)}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={!hasContent || isSaving}>
              {isSaving ? 'Saving...' : 'Add Entry'}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mx-6 mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {lengthState !== 'good' && hasContent ? (
          <div className={warningClass(lengthState)}>
            {warningMessage(lengthState, guidance)}
          </div>
        ) : null}

        <div className="flex-1 p-6">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a short note about what changed today, what you learned, or what context should matter for the next conversation..."
            spellCheck={false}
            className="h-full min-h-[320px] w-full resize-none rounded-[28px] border border-border bg-secondary/20 px-5 py-4 font-mono text-sm leading-7 outline-none transition-colors focus:border-primary/40"
          />
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-muted-foreground">
          <span>
            {trimmedContent.length} characters, {wordCount} words
          </span>
          <span>{statusLabel(lengthState)} · Ctrl/Cmd+Enter to save, Esc to close</span>
        </div>
      </div>
    </div>
  );
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function statusLabel(state: ReturnType<typeof getLengthState>) {
  switch (state) {
    case 'good':
      return 'In recommended range';
    case 'short':
      return 'Below recommended range';
    case 'long':
      return 'Above recommended range';
    case 'over':
      return 'Over soft limit';
  }
}

function warningClass(state: ReturnType<typeof getLengthState>) {
  if (state === 'short') {
    return 'mx-6 mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-700';
  }

  if (state === 'long') {
    return 'mx-6 mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700';
  }

  return 'mx-6 mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700';
}

function warningMessage(state: ReturnType<typeof getLengthState>, guidance: ReturnType<typeof getContentGuidance>) {
  if (state === 'short') {
    return `This entry is still very short. A useful daily log usually lands around ${formatCharacterRange(guidance)}.`;
  }

  if (state === 'long') {
    return `This entry is getting long. Consider keeping it tighter so today's context stays focused.`;
  }

  return `This entry is over the soft limit of ${formatSoftLimit(guidance)}. Consider splitting details into MEMORY.md or a knowledge file.`;
}
