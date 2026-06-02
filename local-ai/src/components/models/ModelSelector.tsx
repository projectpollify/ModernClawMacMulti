import { useEffect, useRef, useState } from 'react';
import {
  getModelCapabilityDetail,
  getModelCapabilitySummary,
  getModelDisplayName,
  IS_MAC_MODEL_PROVIDER,
  MODEL_PROVIDER_NAME,
} from '@/lib/providerConfig';
import { setupApi } from '@/services/setup';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/stores/agentStore';
import { useModelStore } from '@/stores/modelStore';
import { useSettingsStore } from '@/stores/settingsStore';

export function ModelSelector() {
  const models = useModelStore((state) => state.models);
  const currentModel = useModelStore((state) => state.currentModel);
  const engineStatus = useModelStore((state) => state.engineStatus);
  const checkStatus = useModelStore((state) => state.checkStatus);
  const setCurrentModel = useModelStore((state) => state.setCurrentModel);
  const updateActiveAgentDefaultModel = useAgentStore((state) => state.updateActiveAgentDefaultModel);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);
  const [pendingModelName, setPendingModelName] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectModel = async (modelName: string) => {
    if (isSwitchingModel || modelName === currentModel) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    setIsSwitchingModel(true);
    setPendingModelName(modelName);

    try {
      if (IS_MAC_MODEL_PROVIDER) {
        await setupApi.switchDirectEngineModel(modelName);
      }

      setCurrentModel(modelName);
      await updateActiveAgentDefaultModel(modelName);
      await loadSettings();
      await checkStatus();
    } catch {
      void checkStatus();
    } finally {
      setIsSwitchingModel(false);
      setPendingModelName(null);
    }
  };

  if (!engineStatus?.running) {
    return (
      <button
        onClick={() => void checkStatus()}
        className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-500/15"
      >
        {MODEL_PROVIDER_NAME} Offline
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (isSwitchingModel) {
            return;
          }

          setIsOpen((value) => !value);
        }}
        disabled={isSwitchingModel}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-full border border-border/80 bg-[hsl(var(--panel-strong))] px-4 text-sm shadow-[var(--surface-shadow-soft)] transition-all duration-150',
          isSwitchingModel
            ? 'cursor-wait opacity-80'
            : 'hover:border-primary/20 hover:bg-accent/35 hover:text-accent-foreground'
        )}
      >
        {isSwitchingModel ? <SpinnerIcon className="h-3.5 w-3.5 text-primary" /> : <span className="h-2 w-2 rounded-full bg-green-500" />}
        <span className="flex max-w-56 flex-col items-start leading-tight">
          <span className="max-w-56 truncate">
            {isSwitchingModel
              ? `Switching to ${getModelDisplayName(pendingModelName) || 'model'}...`
              : getModelDisplayName(currentModel) || 'Select Model'}
          </span>
          {!isSwitchingModel && currentModel ? (
            <span className="max-w-56 truncate text-[11px] text-muted-foreground">
              {getModelCapabilitySummary(currentModel)}
            </span>
          ) : null}
        </span>
        <ChevronIcon className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180', isSwitchingModel && 'opacity-40')} />
      </button>

      {isOpen ? (
        <div className="absolute left-1/2 top-full z-50 mt-3 w-80 -translate-x-1/2 overflow-hidden rounded-[1.6rem] border border-border/80 bg-[hsl(var(--panel-strong))] shadow-[var(--surface-shadow)] backdrop-blur-[22px]">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Installed Models
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {IS_MAC_MODEL_PROVIDER
                ? 'Choosing a loaded model here saves it as the default for this workspace.'
                : 'Choosing a model here saves it as the default for this workspace.'}
            </p>
            {isSwitchingModel && pendingModelName ? (
              <p className="mt-2 text-xs text-primary">
                Restarting the engine with {getModelDisplayName(pendingModelName)}. This usually takes a few seconds.
              </p>
            ) : null}
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {models.length > 0 ? (
              models.map((model) => (
                <button
                  key={model.name}
                  onClick={() => void handleSelectModel(model.name)}
                  disabled={isSwitchingModel}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors',
                    isSwitchingModel ? 'cursor-wait opacity-60' : 'hover:bg-accent hover:text-accent-foreground',
                    model.name === currentModel && 'bg-accent/45 text-accent-foreground'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{getModelDisplayName(model.name)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {getModelCapabilityDetail(model.name)}
                    </span>
                  </span>
                  {isSwitchingModel && model.name === pendingModelName ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <SpinnerIcon className="h-3 w-3" />
                      Switching
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No models installed
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" className="opacity-20" stroke="currentColor" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
