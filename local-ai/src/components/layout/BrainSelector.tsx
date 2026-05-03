import { useMemo, useState } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useModelStore } from '@/stores/modelStore';

function slugifyBrainName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function uniqueBrainId(base: string, existingIds: string[]) {
  if (!base) {
    return '';
  }

  if (!existingIds.includes(base)) {
    return base;
  }

  let counter = 2;
  let candidate = `${base}-${counter}`;

  while (existingIds.includes(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }

  return candidate;
}

export function BrainSelector() {
  const agents = useAgentStore((state) => state.agents);
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const isLoading = useAgentStore((state) => state.isLoading);
  const storeError = useAgentStore((state) => state.error);
  const setActiveAgent = useAgentStore((state) => state.setActiveAgent);
  const createAgent = useAgentStore((state) => state.createAgent);
  const renameAgent = useAgentStore((state) => state.renameAgent);
  const deleteAgent = useAgentStore((state) => state.deleteAgent);
  const currentModel = useModelStore((state) => state.currentModel);

  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [brainName, setBrainName] = useState('');
  const [brainPurpose, setBrainPurpose] = useState('');
  const [renameName, setRenameName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRenamingSubmit, setIsRenamingSubmit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const value = activeAgent?.agentId ?? '';
  const existingIds = useMemo(() => agents.map((agent) => agent.agentId), [agents]);
  const normalizedExistingNames = useMemo(
    () => new Set(agents.map((agent) => agent.name.trim().toLowerCase())),
    [agents]
  );
  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of agents) {
      counts.set(agent.name, (counts.get(agent.name) ?? 0) + 1);
    }
    return counts;
  }, [agents]);
  const suggestedId = uniqueBrainId(slugifyBrainName(brainName), existingIds);
  const canDeleteActiveBrain = Boolean(
    activeAgent &&
      activeAgent.agentId !== 'default' &&
      activeAgent.agentId !== 'joe-support' &&
      agents.length > 1
  );
  const canRenameActiveBrain = Boolean(
    activeAgent && activeAgent.agentId !== 'default' && activeAgent.agentId !== 'joe-support'
  );
  const optionStyle = { color: '#0f172a', backgroundColor: '#ffffff' };

  const handleCreateBrain = async () => {
    const trimmedName = brainName.trim();
    const trimmedPurpose = brainPurpose.trim();

    if (!trimmedName) {
      setLocalError('Give the new brain a name first.');
      return;
    }

    if (normalizedExistingNames.has(trimmedName.toLowerCase())) {
      setLocalError('That brain name is already in use. Pick a different display name so the selector stays clear.');
      return;
    }

    if (!suggestedId) {
      setLocalError('Could not generate a valid brain ID from that name.');
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);

    try {
      await createAgent({
        agentId: suggestedId,
        name: trimmedName,
        description: trimmedPurpose || undefined,
        defaultModel: currentModel ?? undefined,
      });
      await setActiveAgent(suggestedId);
      setBrainName('');
      setBrainPurpose('');
      setIsCreating(false);
      setIsMenuOpen(false);
      setLocalError(null);
    } catch (error) {
      setLocalError(String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenRename = () => {
    if (!activeAgent || !canRenameActiveBrain) {
      return;
    }

    setIsCreating(false);
    setIsConfirmingDelete(false);
    setIsMenuOpen(false);
    setLocalError(null);
    setRenameName(activeAgent.name);
    setIsRenaming(true);
  };

  const handleRenameBrain = async () => {
    if (!activeAgent || !canRenameActiveBrain) {
      return;
    }

    const trimmedName = renameName.trim();

    if (!trimmedName) {
      setLocalError('Give this brain a name first.');
      return;
    }

    const duplicate = agents.some(
      (agent) => agent.agentId !== activeAgent.agentId && agent.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setLocalError('That brain name is already in use. Pick a different display name so the selector stays clear.');
      return;
    }

    if (trimmedName === activeAgent.name.trim()) {
      setIsRenaming(false);
      setLocalError(null);
      return;
    }

    setIsRenamingSubmit(true);
    setLocalError(null);

    try {
      await renameAgent(activeAgent.agentId, trimmedName);
      setIsRenaming(false);
      setIsMenuOpen(false);
      setRenameName('');
    } catch (error) {
      setLocalError(String(error));
    } finally {
      setIsRenamingSubmit(false);
    }
  };

  const handleDeleteBrain = async () => {
    if (!activeAgent || !canDeleteActiveBrain) {
      return;
    }

    setIsDeleting(true);
    setLocalError(null);

    try {
      await deleteAgent(activeAgent.agentId);
      setIsConfirmingDelete(false);
      setIsMenuOpen(false);
    } catch (error) {
      setLocalError(String(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex min-w-[252px] items-center gap-3 rounded-[1.35rem] border border-border/80 bg-[hsl(var(--panel-strong))] px-3 py-2.5 shadow-[var(--surface-shadow-soft)] backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
          <span className="text-base leading-none" aria-hidden="true">
            🧠
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Active Brain
          </p>
          <select
            value={value}
            onChange={(event) => void setActiveAgent(event.target.value)}
            disabled={isLoading || !agents.length}
            className={cn(
              'mt-1 w-full bg-transparent text-sm font-medium text-foreground outline-none',
              'disabled:cursor-not-allowed disabled:text-muted-foreground'
            )}
            aria-label="Select active brain"
          >
            {agents.length ? null : <option value="">Loading brains...</option>}
            {agents.map((agent) => {
              const showId = (duplicateNameCounts.get(agent.name) ?? 0) > 1;
              const optionLabel = showId ? `${agent.name} (${agent.agentId})` : agent.name;

              return (
                <option key={agent.agentId} value={agent.agentId} style={optionStyle}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-11 rounded-[1.35rem] border-border/80 bg-[hsl(var(--panel-strong))] px-4 text-sm text-foreground shadow-[var(--surface-shadow-soft)] whitespace-nowrap hover:border-primary/30 hover:bg-primary/5"
          onClick={() => {
            setIsCreating(false);
            setIsRenaming(false);
            setIsConfirmingDelete(false);
            setIsMenuOpen((value) => !value);
            setLocalError(null);
          }}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          Brain Options
          <ChevronIcon className={cn('ml-2 h-4 w-4 transition-transform', isMenuOpen && 'rotate-180')} />
        </Button>

        {isMenuOpen ? (
          <div className="absolute right-0 top-full z-50 mt-3 w-[240px] rounded-[1.4rem] border border-border/80 bg-[hsl(var(--panel-strong))] p-2 shadow-[var(--surface-shadow)] backdrop-blur-[22px]">
            <div className="rounded-xl bg-secondary/35 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Brain Type</p>
              <p className="mt-1 text-sm font-medium capitalize text-foreground">
                {activeAgent?.profileKind === 'main'
                  ? 'Main'
                  : activeAgent?.profileKind === 'support'
                    ? 'Support'
                    : 'Custom'}
              </p>
            </div>

            <div className="my-2 h-px bg-border/70" />

            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent/45"
              onClick={() => {
                setIsMenuOpen(false);
                setIsRenaming(false);
                setIsConfirmingDelete(false);
                setIsCreating(true);
                setLocalError(null);
              }}
            >
              <PlusIcon className="h-4 w-4" />
              <span>New Brain</span>
            </button>

            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                canRenameActiveBrain
                  ? 'text-foreground hover:bg-accent/45'
                  : 'cursor-not-allowed text-muted-foreground'
              )}
              onClick={() => {
                if (!canRenameActiveBrain) {
                  return;
                }
                handleOpenRename();
              }}
              disabled={!canRenameActiveBrain || isSubmitting || isDeleting || isLoading}
            >
              <PencilIcon className="h-4 w-4" />
              <span>Edit Name</span>
            </button>

            <div className="my-2 h-px bg-border/70" />

            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                canDeleteActiveBrain
                  ? 'text-red-600 hover:bg-red-500/10 hover:text-red-700'
                  : 'cursor-not-allowed text-muted-foreground'
              )}
              onClick={() => {
                if (!canDeleteActiveBrain) {
                  return;
                }
                setIsCreating(false);
                setIsRenaming(false);
                setLocalError(null);
                setIsMenuOpen(false);
                setIsConfirmingDelete(true);
              }}
              disabled={!canDeleteActiveBrain || isDeleting || isLoading}
            >
              <TrashIcon className="h-4 w-4" />
              <span>{isDeleting ? 'Deleting...' : 'Delete Brain'}</span>
            </button>
          </div>
        ) : null}
      </div>

      {isCreating ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[360px] rounded-[1.6rem] border border-border/80 bg-[hsl(var(--panel-strong))] p-4 shadow-[var(--surface-shadow)] backdrop-blur-[22px]">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Create Brain</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a new isolated workspace with its own SOUL, USER, MEMORY, knowledge, and curator flow.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
              <input
                value={brainName}
                onChange={(event) => setBrainName(event.target.value)}
                placeholder="Rosie"
                className="w-full rounded-2xl border border-border bg-secondary/35 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Purpose</span>
              <textarea
                value={brainPurpose}
                onChange={(event) => setBrainPurpose(event.target.value)}
                placeholder="Marketing strategist, launch planner, and product explainer"
                rows={3}
                className="w-full rounded-2xl border border-border bg-secondary/35 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
              />
            </label>

            <div className="rounded-2xl border border-border/80 bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
              Brain ID: <span className="font-mono text-foreground">{suggestedId || 'enter a name first'}</span>
            </div>

            {localError || storeError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                {localError || storeError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreating(false);
                  setBrainName('');
                  setBrainPurpose('');
                  setLocalError(null);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleCreateBrain()} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Brain'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isRenaming && activeAgent ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[360px] rounded-[1.6rem] border border-border/80 bg-[hsl(var(--panel-strong))] p-4 shadow-[var(--surface-shadow)] backdrop-blur-[22px]">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Rename Brain</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Update the display name for this brain without changing its brain ID or workspace folder.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Display Name</span>
              <input
                value={renameName}
                onChange={(event) => setRenameName(event.target.value)}
                placeholder="Political Bob"
                className="w-full rounded-2xl border border-border bg-secondary/35 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
              />
            </label>

            <div className="rounded-2xl border border-border/80 bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
              Brain ID stays <span className="font-mono text-foreground">{activeAgent.agentId}</span>
            </div>

            {localError || storeError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                {localError || storeError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsRenaming(false);
                  setRenameName('');
                  setLocalError(null);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleRenameBrain()} disabled={isRenamingSubmit}>
                {isRenamingSubmit ? 'Saving...' : 'Save Name'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isConfirmingDelete && activeAgent ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-2xl border border-red-500/15 bg-background p-4 shadow-2xl">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">Delete Brain</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              Delete <span className="font-semibold text-foreground">{activeAgent.name}</span> and remove its
              conversations plus local workspace files. This cannot be undone.
            </p>
          </div>

          {localError || storeError ? (
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
              {localError || storeError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsConfirmingDelete(false);
                setLocalError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="border border-red-500/20 bg-red-500/5 text-red-600 hover:bg-red-500/12 hover:text-red-700"
              onClick={() => void handleDeleteBrain()}
              disabled={isDeleting}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6M14 11v6" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
      />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h4l10-10a2.1 2.1 0 00-4-4L4 16v4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m13.5 6.5 4 4" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m5 7 5 5 5-5" />
    </svg>
  );
}
