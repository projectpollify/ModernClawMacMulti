import { useEffect, useState } from 'react';
import { DailyLogComposer } from '@/components/memory/DailyLogComposer';
import { DailyLogViewer } from '@/components/memory/DailyLogViewer';
import { Button } from '@/components/ui/Button';
import { useAgentStore } from '@/stores/agentStore';
import { useMemoryStore } from '@/stores/memoryStore';

export function DailyLogList() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const dailyLogs = useMemoryStore((state) => state.dailyLogs);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const brainName = activeAgent?.name ?? 'this brain';

  useEffect(() => {
    setSelectedDate(null);
    setIsComposing(false);
  }, [activeAgent?.agentId]);

  const handleSaved = (date: string) => {
    setIsComposing(false);
    setSelectedDate(date);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-6 text-muted-foreground">
          These entries belong only to {brainName}.
        </p>
        <Button variant="outline" size="sm" onClick={() => setIsComposing(true)}>
          New Entry
        </Button>
      </div>

      {dailyLogs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-background/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No daily logs yet for {brainName}. Create the first entry to start building short-term memory for this brain.
          </p>
          <Button className="mt-4" onClick={() => setIsComposing(true)}>
            Create Today&apos;s First Entry
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {dailyLogs.slice(0, 14).map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className="flex items-center justify-between rounded-2xl border border-border bg-background/75 px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <div>
                <p className="text-sm font-medium">{formatDate(date)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{date}</p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                View
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedDate ? (
        <DailyLogViewer date={selectedDate} onClose={() => setSelectedDate(null)} />
      ) : null}

      {isComposing ? (
        <DailyLogComposer onClose={() => setIsComposing(false)} onSaved={handleSaved} />
      ) : null}
    </>
  );
}

function formatDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayString = today.toISOString().slice(0, 10);
  const yesterdayString = yesterday.toISOString().slice(0, 10);

  if (dateString === todayString) {
    return 'Today';
  }

  if (dateString === yesterdayString) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
