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

  const context = metrics.context;
  const usagePercent = context ? Math.max(0, Math.min(100, context.usagePercent)) : null;
  const stats = [
    metrics.tokensPerSecond ? `${formatRate(metrics.tokensPerSecond)} tok/sec` : null,
    metrics.outputTokens ? `${metrics.outputTokens.toLocaleString()} tokens` : null,
    metrics.totalDurationMs ? formatDuration(metrics.totalDurationMs) : null,
    metrics.finishReason ? `Stop reason: ${formatFinishReason(metrics.finishReason)}` : null,
  ].filter((value): value is string => Boolean(value));

  if (!context && stats.length === 0) {
    return null;
  }

  return (
    <div className={cn('mt-3 space-y-2', className)}>
      {context ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-[11px] opacity-70">
            <span>Context used</span>
            <span>
              {Math.round(usagePercent ?? 0)}% · {context.totalTokens.toLocaleString()} / {context.maxTokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.max(4, usagePercent ?? 0)}%` }}
            />
          </div>
        </div>
      ) : null}

      {stats.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-[11px] opacity-70">
          {stats.map((stat) => (
            <span key={stat}>{stat}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${Math.round(durationMs)}ms`;
  }

  return `${(durationMs / 1_000).toFixed(durationMs >= 10_000 ? 0 : 2)}s`;
}

function formatRate(tokensPerSecond: number) {
  return tokensPerSecond >= 10 ? tokensPerSecond.toFixed(2) : tokensPerSecond.toFixed(3);
}

function formatFinishReason(reason: string) {
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
