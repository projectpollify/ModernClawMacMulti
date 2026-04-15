import { useAgentStore } from '@/stores/agentStore';
import { useMemoryStore } from '@/stores/memoryStore';

export function KnowledgeFiles() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const knowledgeFiles = useMemoryStore((state) => state.knowledgeFiles);
  const brainName = activeAgent?.name ?? 'this brain';

  if (knowledgeFiles.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-background/60 p-6 text-center">
        <p className="text-sm text-muted-foreground">No knowledge files yet for {brainName}.</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Add Markdown files to the <code className="rounded bg-secondary px-1.5 py-0.5">knowledge/</code>{' '}
          folder to give {brainName} local reference material.
        </p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Files added outside the app appear here after refresh for the active brain only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-6 text-muted-foreground">
        These files are loaded for {brainName}. Files added outside the app appear here after refresh.
      </p>

      <div className="grid gap-3">
        {knowledgeFiles.map((filename) => (
          <div
            key={filename}
            className="flex items-center justify-between rounded-2xl border border-border bg-background/75 px-4 py-3"
          >
            <div>
              <p className="font-mono text-sm text-foreground">{filename}</p>
              <p className="mt-1 text-xs text-muted-foreground">knowledge/{filename}</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
              Loaded
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
