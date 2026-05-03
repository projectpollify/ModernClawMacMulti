import { Button } from '@/components/ui/Button';
import { formatCharacterRange, formatSoftLimit, getContentGuidance, getLengthState } from '@/lib/contentGuidance';
import type { BrainSuggestion } from '@/types';

interface QuestionQueueCardProps {
  suggestion: BrainSuggestion;
  draftAnswer?: string;
  feedback?: string | null;
  isApplying?: boolean;
  onDraftAnswerChange: (value: string) => void;
  onApply: () => void;
  onDefer: () => void;
  onDismiss: () => void;
}

export function QuestionQueueCard({
  suggestion,
  draftAnswer,
  feedback,
  isApplying = false,
  onDraftAnswerChange,
  onApply,
  onDefer,
  onDismiss,
}: QuestionQueueCardProps) {
  const guidance = getContentGuidance('profile-answer');
  const answerLength = (draftAnswer ?? '').trim().length;
  const answerState = getLengthState(answerLength, guidance);

  return (
    <article className="rounded-[28px] border border-primary/20 bg-primary/5 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Question Queue</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">{suggestion.title}</h3>
        </div>
        <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
          {suggestion.target}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-foreground">{suggestion.questionPrompt}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{suggestion.reason}</p>

      <div className="mt-4 rounded-2xl border border-border bg-background/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Your Answer
          </label>
          <span className="text-xs text-muted-foreground">
            {formatCharacterRange(guidance)} recommended · {formatSoftLimit(guidance)} soft limit
          </span>
        </div>

        <textarea
          value={draftAnswer ?? ''}
          onChange={(event) => onDraftAnswerChange(event.target.value)}
          placeholder="Write a durable answer that should become part of the local brain..."
          className="mt-3 min-h-[140px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{answerLength} characters</span>
          <span>{answerStatusLabel(answerState)}</span>
        </div>
      </div>

      {feedback ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {feedback}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="sm" className="px-4" onClick={onApply} disabled={isApplying}>
          {isApplying ? 'Applying...' : 'Save Answer'}
        </Button>
        <Button size="sm" className="px-4" variant="outline" onClick={onDefer} disabled={isApplying}>
          Ask Later
        </Button>
        <Button size="sm" className="px-2" variant="ghost" onClick={onDismiss} disabled={isApplying}>
          Dismiss
        </Button>
      </div>
    </article>
  );
}

function answerStatusLabel(state: ReturnType<typeof getLengthState>) {
  switch (state) {
    case 'good':
      return 'In recommended range';
    case 'short':
      return 'Still short';
    case 'long':
      return 'Getting long';
    case 'over':
      return 'Over soft limit';
  }
}
