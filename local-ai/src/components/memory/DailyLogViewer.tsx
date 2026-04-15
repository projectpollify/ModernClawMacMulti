import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { memoryApi, type DailyLog } from '@/services/memory';
import { useAgentStore } from '@/stores/agentStore';

interface DailyLogViewerProps {
  date: string;
  onClose: () => void;
}

export function DailyLogViewer({ date, onClose }: DailyLogViewerProps) {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const [log, setLog] = useState<DailyLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const brainName = activeAgent?.name ?? 'this brain';

  useEffect(() => {
    let cancelled = false;

    const loadLog = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const file = await memoryApi.readFile(`memory/${date}.md`);
        if (!cancelled) {
          setLog({
            date,
            path: file.path,
            content: file.content,
            exists: file.exists,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(String(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadLog();
    return () => {
      cancelled = true;
    };
  }, [date, activeAgent?.agentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-[30px] border border-border bg-background shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Daily Log</h2>
            <p className="mt-1 text-sm text-muted-foreground">{date}</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Viewing {brainName}&apos;s entry for this date.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading log...</p>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-secondary/20 p-4 font-mono text-sm leading-7 text-foreground">
              {log?.content || 'This log is empty.'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
