import { cn } from '@/lib/utils';
import type { MessageMetrics } from '@/types';

interface MessageMetricsRowProps {
  metrics?: MessageMetrics | null;
  className?: string;
}

export function MessageMetricsRow({ metrics, className }: MessageMetricsRowProps) {
  if (!metrics) {
    return null;
  }

  const stats = [
    metrics.totalDurationMs ? `Answered in ${formatDuration(metrics.totalDurationMs)}` : null,
    metrics.outputTokens ? `${metrics.outputTokens.toLocaleString()} response tokens` : null,
    metrics.finishReason ? formatFinishReason(metrics.finishReason) : null,
  ].filter((value): value is string => Boolean(value));

  if (stats.length === 0) {
    return null;
  }

  return (
    <div className={cn('mt-3 space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-3 text-[11px] opacity-70">
        {stats.map((stat) => (
          <span key={stat}>{stat}</span>
        ))}
      </div>
    </div>
  );
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${Math.round(durationMs)}ms`;
  }

  return `${(durationMs / 1_000).toFixed(durationMs >= 10_000 ? 0 : 2)}s`;
}

function formatFinishReason(reason: string) {
  if (reason === 'stop') {
    return 'Completed';
  }

  if (reason === 'length') {
    return 'Stopped at the reply limit';
  }

  return 'Finished';
}
