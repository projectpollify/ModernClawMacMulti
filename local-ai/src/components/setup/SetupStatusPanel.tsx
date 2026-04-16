import { ModelDownloadProgressCard } from '@/components/models/ModelDownloadProgressCard';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { useSetupActions } from '@/hooks/useSetupActions';
import { APP_DISPLAY_NAME, IS_MAC_MODEL_PROVIDER } from '@/lib/providerConfig';
import { cn } from '@/lib/utils';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import type { SetupChecklistItem, SetupNextStep } from '@/lib/setupStatus';
import { memoryApi } from '@/services/memory';
import { useModelStore } from '@/stores/modelStore';
import { useViewStore } from '@/stores/uiStore';

interface SetupStatusPanelProps {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

export function SetupStatusPanel({
  title = 'Setup Status',
  description = 'One place to confirm what is ready now, what still needs attention, and which voice features are optional.',
  className,
  compact = false,
}: SetupStatusPanelProps) {
  const { requiredItems, optionalItems, summary, nextStep, isRefreshing, runRefresh, settings, memoryBasePath } = useSetupStatus();
  const engineStatus = useModelStore((state) => state.engineStatus);
  const downloadProgress = useModelStore((state) => state.downloadProgress);
  const setView = useViewStore((state) => state.setView);
  const {
    openProviderApp,
    startEngine,
    installRecommendedModel,
    initializeWorkspace,
    isOpeningDownload,
    isStartingEngine,
    isInstallingRecommendedModel,
    isInitializingWorkspace,
    isDownloadingAnyModel,
    actionError,
    actionNotice,
    clearActionError,
    clearActionNotice,
  } = useSetupActions();

  const summaryTone =
    summary.requiredReady === summary.requiredTotal ? 'border-green-500/20 bg-green-500/10' : 'border-amber-500/20 bg-amber-500/10';

  const handleOpenFolder = async () => {
    try {
      await memoryApi.openFolder();
    } catch {
      const fallbackPath = memoryBasePath ?? settings.memoryPath ?? 'Path unavailable';
      window.alert(`Unable to open the workspace folder.\n\n${fallbackPath}`);
    }
  };

  const renderSetupActions = (step: SetupNextStep | SetupChecklistItem) => {
    if (step.id === 'engine') {
      return (
        <>
          <Button variant="outline" size="sm" onClick={() => void openProviderApp()} disabled={isOpeningDownload}>
            {isOpeningDownload ? 'Opening...' : 'Engine Guide'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void startEngine()} disabled={isStartingEngine}>
            {isStartingEngine ? 'Starting Engine...' : 'Start Engine'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void runRefresh()} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </>
      );
    }

    if (step.id === 'model') {
      return (
        <>
          {engineStatus?.running ? (
            <Button size="sm" onClick={() => void installRecommendedModel()} disabled={isInstallingRecommendedModel || isDownloadingAnyModel}>
              {isInstallingRecommendedModel || isDownloadingAnyModel
                ? IS_MAC_MODEL_PROVIDER
                  ? 'Checking Models...'
                  : 'Installing Model...'
                : IS_MAC_MODEL_PROVIDER
                  ? 'Confirm Gemma 4 In Engine'
                  : 'Install Recommended Model'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void startEngine()}
              disabled={isStartingEngine}
            >
              {isStartingEngine ? 'Starting Engine...' : 'Start Engine First'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void runRefresh()} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </>
      );
    }

    if (step.id === 'memory') {
      return (
        <>
          <Button variant="outline" size="sm" onClick={() => void initializeWorkspace()} disabled={isInitializingWorkspace}>
            {isInitializingWorkspace ? 'Initializing...' : 'Initialize Workspace'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleOpenFolder()} disabled={!memoryBasePath && !settings.memoryPath}>
            Open Workspace Folder
          </Button>
        </>
      );
    }

    if (step.id === 'ready') {
      return (
        <>
          <Button size="sm" onClick={() => setView('chat')}>
            Open Chat
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView('memory')}>
            Open Memory
          </Button>
        </>
      );
    }

    return null;
  };

  return (
    <section className={cn('rounded-[30px] border border-border bg-background/75 p-5 shadow-sm', className)}>
      <div className={cn('flex gap-4', compact ? 'flex-col' : 'flex-col lg:flex-row lg:items-start lg:justify-between')}>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void runRefresh()} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : 'Refresh Checks'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleOpenFolder()} disabled={!memoryBasePath && !settings.memoryPath}>
            Open Workspace Folder
          </Button>
        </div>
      </div>

      <div className={cn('mt-5 rounded-[24px] border px-4 py-4', summaryTone)}>
        <p className="text-sm font-medium">
          {summary.requiredReady === summary.requiredTotal
            ? `${APP_DISPLAY_NAME} is ready for core use.`
            : `${APP_DISPLAY_NAME} still needs attention before setup is fully ready.`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Required setup: {summary.requiredReady}/{summary.requiredTotal} ready. Voice input and output stay optional and can be enabled later when you want them.
        </p>
      </div>

      <div className="mt-4 rounded-[24px] border border-primary/20 bg-primary/5 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Next Required Action</p>
        <p className="mt-2 text-sm font-medium">{nextStep.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{nextStep.detail}</p>
        {renderSetupActions(nextStep) ? <div className="mt-4 flex flex-wrap gap-2">{renderSetupActions(nextStep)}</div> : null}
      </div>

      {actionError ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <span>{actionError}</span>
          <Button variant="ghost" size="sm" onClick={clearActionError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {actionNotice ? (
        <div
          className={cn(
            'mt-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm',
            actionNotice.tone === 'success'
              ? 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300'
              : 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
          )}
        >
          <span>{actionNotice.message}</span>
          <Button variant="ghost" size="sm" onClick={clearActionNotice}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {downloadProgress ? <ModelDownloadProgressCard progress={downloadProgress} className="mt-4" /> : null}

      <div className={cn('mt-5 grid gap-5', compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2')}>
        <ChecklistGroup
          title="Required Setup"
          description="These items need to be ready before normal chat use."
          items={requiredItems}
          renderActions={(item) => (item.state === 'attention' ? renderSetupActions(item) : null)}
        />
        <ChecklistGroup
          title="Optional Features"
          description="These can be skipped for now and enabled later in Settings."
          items={optionalItems}
        />
      </div>
    </section>
  );
}

function ChecklistGroup({
  title,
  description,
  items,
  renderActions,
}: {
  title: string;
  description: string;
  items: SetupChecklistItem[];
  renderActions?: (item: SetupChecklistItem) => ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const actions = renderActions?.(item);

          return (
            <div key={item.id} className="rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
                <StatusBadge state={item.state} />
              </div>

              {item.notes && item.notes.length > 0 ? (
                <div className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
                  {item.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              ) : null}

              {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: SetupChecklistItem['state'] }) {
  const label =
    state === 'ready'
      ? 'Ready'
      : state === 'attention'
        ? 'Needs Attention'
        : state === 'checking'
          ? 'Checking'
          : 'Optional';

  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
        state === 'ready'
          ? 'bg-green-500/12 text-green-700 dark:text-green-300'
          : state === 'attention'
            ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
            : state === 'checking'
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-slate-500/12 text-slate-700 dark:text-slate-300'
      )}
    >
      {label}
    </span>
  );
}
