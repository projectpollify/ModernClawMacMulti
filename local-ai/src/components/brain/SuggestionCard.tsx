import { Button } from '@/components/ui/Button';
import { formatCharacterRange, formatSoftLimit, getContentGuidance, getLengthState } from '@/lib/contentGuidance';
import type { BrainSuggestion, SuggestionKind } from '@/types';

interface SuggestionCardProps {
  suggestion: BrainSuggestion;
  draftAnswer?: string;
  acceptLabel?: string;
  isApplying?: boolean;
  feedback?: string | null;
  onDraftAnswerChange?: (value: string) => void;
  onAccept: () => void;
  onDefer: () => void;
  onDismiss: () => void;
}

const kindLabels: Record<SuggestionKind, string> = {
  profile: 'Profile',
  memory: 'Memory',
  knowledge: 'Knowledge',
  behavior: 'Behavior',
};

export function SuggestionCard({
  suggestion,
  draftAnswer,
  acceptLabel = 'Accept',
  isApplying = false,
  feedback,
  onDraftAnswerChange,
  onAccept,
  onDefer,
  onDismiss,
}: SuggestionCardProps) {
  const answerGuidance = getContentGuidance('profile-answer');
  const answerLength = (draftAnswer ?? '').trim().length;
  const answerState = getLengthState(answerLength, answerGuidance);

  return (
    <article className="rounded-[28px] border border-border bg-background/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {kindLabels[suggestion.kind]}
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">{suggestion.title}</h3>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
          {suggestion.target}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-foreground">{suggestion.summary}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{suggestion.reason}</p>

      {suggestion.questionPrompt ? (
        <div className="mt-4 rounded-2xl border border-border bg-secondary/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Suggested Question
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">{suggestion.questionPrompt}</p>

          {onDraftAnswerChange ? (
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Your Answer
              </label>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                Recommended length: {formatCharacterRange(answerGuidance)}. Soft limit: {formatSoftLimit(answerGuidance)}.
              </p>
              <textarea
                value={draftAnswer ?? ''}
                onChange={(event) => onDraftAnswerChange(event.target.value)}
                placeholder="Write the answer that should be added to your local brain..."
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{answerLength} characters</span>
                <span>{answerStatusLabel(answerState)}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {suggestion.proposedContent ? (
        <div className="mt-4 rounded-2xl border border-border bg-secondary/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Proposed Content
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-6 text-foreground">
            {suggestion.proposedContent}
          </pre>
        </div>
      ) : null}

      {feedback ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {feedback}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="sm" className="px-4" onClick={onAccept} disabled={isApplying}>
          {isApplying ? 'Applying...' : acceptLabel}
        </Button>
        <Button size="sm" className="px-4" variant="outline" onClick={onDefer} disabled={isApplying}>
          Defer
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
