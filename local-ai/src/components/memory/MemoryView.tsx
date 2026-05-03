import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { DailyLogList } from '@/components/memory/DailyLogList';
import { KnowledgeFiles } from '@/components/memory/KnowledgeFiles';
import { MemoryFileCard } from '@/components/memory/MemoryFileCard';
import { formatCharacterRange, getContentGuidance } from '@/lib/contentGuidance';
import { memoryApi } from '@/services/memory';
import { useAgentStore } from '@/stores/agentStore';
import { useMemoryStore } from '@/stores/memoryStore';

export function MemoryView() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const initialize = useMemoryStore((state) => state.initialize);
  const soul = useMemoryStore((state) => state.soul);
  const user = useMemoryStore((state) => state.user);
  const memory = useMemoryStore((state) => state.memory);
  const knowledgeFiles = useMemoryStore((state) => state.knowledgeFiles);
  const basePath = useMemoryStore((state) => state.basePath);
  const isLoading = useMemoryStore((state) => state.isLoading);
  const error = useMemoryStore((state) => state.error);
  const clearError = useMemoryStore((state) => state.clearError);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleOpenFolder = async () => {
    try {
      await memoryApi.openFolder();
    } catch {
      window.alert(`Unable to open the memory folder.\n\n${basePath ?? 'Path unavailable'}`);
    }
  };

  const soulGuidance = getContentGuidance('SOUL.md');
  const userGuidance = getContentGuidance('USER.md');
  const memoryGuidance = getContentGuidance('MEMORY.md');
  const logGuidance = getContentGuidance('daily-log');
  const knowledgeGuidance = getContentGuidance('knowledge-file');

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-6">
        <section className="rounded-[32px] border border-border bg-background/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Open Brain
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Memory Workspace</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Personality, user context, durable memory, daily logs, and knowledge references all live
                here as local Markdown files.
              </p>
              {activeAgent ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] text-secondary-foreground">
                  <span className="font-semibold uppercase tracking-[0.16em]">Active Brain</span>
                  <span>{activeAgent.name}</span>
                </div>
              ) : null}
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                Writing budgets matter here. Keep files focused so they stay useful in prompt context instead
                of turning into giant dumping grounds.
              </p>
              {basePath ? (
                <p className="mt-3 text-xs text-muted-foreground">Storage path: {basePath}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void initialize()}>
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleOpenFolder()} disabled={!basePath}>
                Open Folder
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        ) : null}

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Core Memory Files</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit the files that shape how your assistant behaves and what it remembers.
              </p>
              {activeAgent ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  You are editing the live workspace for <span className="font-medium text-foreground">{activeAgent.name}</span>.
                </p>
              ) : null}
            </div>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading memory...</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MemoryFileCard
              title="SOUL.md"
              description={`Defines the assistant's personality, tone, and behavioral rules. Recommended: ${formatCharacterRange(soulGuidance)}.`}
              file={soul}
            />
            <MemoryFileCard
              title="USER.md"
              description={`Stores user-specific context, preferences, and helpful personal details. Recommended: ${formatCharacterRange(userGuidance)}.`}
              file={user}
            />
            <MemoryFileCard
              title="MEMORY.md"
              description={`Captures durable facts, decisions, projects, and other long-term notes. Recommended: ${formatCharacterRange(memoryGuidance)}.`}
              file={memory}
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-[30px] border border-border bg-background/75 p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight">Daily Logs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent day-by-day entries that keep short-term context accessible.
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Recommended entry length: {formatCharacterRange(logGuidance)}.
            </p>
            <div className="mt-5">
              <DailyLogList />
            </div>
          </section>

          <section className="rounded-[30px] border border-border bg-background/75 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Knowledge Files</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reference material loaded from the local knowledge folder.
                </p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  Recommended per file: {formatCharacterRange(knowledgeGuidance)}.
                </p>
              </div>
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                {knowledgeFiles.length} files
              </span>
            </div>
            <div className="mt-5">
              <KnowledgeFiles />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
