import { useEffect, useMemo, useState } from 'react';
import { ModelDownloadProgressCard } from '@/components/models/ModelDownloadProgressCard';
import { Button } from '@/components/ui/Button';
import { useSetupActions } from '@/hooks/useSetupActions';
import {
  APP_DISPLAY_NAME,
  getModelDisplayName,
  IS_MAC_MODEL_PROVIDER,
  MODEL_PROVIDER_NAME,
  isRecommendedModelName,
} from '@/lib/providerConfig';
import { CURATED_FLOOR_MODELS, DEFAULT_FLOOR_MODEL } from '@/lib/voiceCatalog';
import { cn } from '@/lib/utils';
import { useModelStore } from '@/stores/modelStore';

interface ModelStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ModelStep({ onNext, onBack }: ModelStepProps) {
  const models = useModelStore((state) => state.models);
  const downloadingModel = useModelStore((state) => state.downloadingModel);
  const downloadProgress = useModelStore((state) => state.downloadProgress);
  const loadModels = useModelStore((state) => state.loadModels);
  const error = useModelStore((state) => state.error);
  const clearError = useModelStore((state) => state.clearError);
  const {
    installRecommendedModel,
    isInstallingRecommendedModel,
    actionError,
    actionNotice,
    clearActionError,
    clearActionNotice,
    openProviderApp,
    isOpeningDownload,
  } = useSetupActions();
  const [selectedModel, setSelectedModel] = useState(DEFAULT_FLOOR_MODEL);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const hasModels = models.length > 0;
  const installedNames = useMemo(() => new Set(models.map((model) => model.name)), [models]);
  const recommendedModelReady = useMemo(
    () =>
      IS_MAC_MODEL_PROVIDER
        ? models.some((model) => isRecommendedModelName(model.name))
        : installedNames.has(DEFAULT_FLOOR_MODEL),
    [installedNames, models]
  );

  const handleDownload = async () => {
    clearError();
    if (IS_MAC_MODEL_PROVIDER || selectedModel === DEFAULT_FLOOR_MODEL) {
      await installRecommendedModel();
      return;
    }

    const modelStore = useModelStore.getState();
    await modelStore.downloadModel(selectedModel);
    await loadModels();
  };

  return (
    <StepShell
      eyebrow="Step 2"
      title={IS_MAC_MODEL_PROVIDER ? 'Load a Model' : 'Choose a Model'}
      description={
        IS_MAC_MODEL_PROVIDER
          ? `Start the ${MODEL_PROVIDER_NAME} local server, load a Gemma 4 model there, and ${APP_DISPLAY_NAME} will use that lane as the default Mac workspace engine.`
          : 'Install a supported Gemma 4 model so ModernClaw starts from a strong default lane, with a lighter sibling available if you want a smaller local footprint.'
      }
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!hasModels}
      backLabel="Back"
      nextLabel={hasModels ? 'Continue to Workspace' : 'Continue'}
    >
      {hasModels ? (
        <div className="rounded-[28px] border border-green-500/25 bg-green-500/10 p-6">
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
            {IS_MAC_MODEL_PROVIDER ? 'Loaded Models Ready' : 'Installed Models Ready'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {models.map((model) => getModelDisplayName(model.name)).join(', ')}. The next step is confirming the workspace files.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {CURATED_FLOOR_MODELS.map((model) => (
            <label
              key={model.name}
              className={cn(
                'cursor-pointer rounded-[24px] border p-4 transition-colors',
                selectedModel === model.name
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background/70 hover:border-primary/40'
              )}
            >
              <input
                type="radio"
                name="recommended-model"
                value={model.name}
                checked={selectedModel === model.name}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="sr-only"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{getModelDisplayName(model.name)}</p>
                    {model.recommended ? (
                      <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">Recommended</span>
                    ) : null}
                    {(IS_MAC_MODEL_PROVIDER ? recommendedModelReady && model.recommended : installedNames.has(model.name)) ? (
                      <span className="rounded-full bg-green-500/12 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
                        {IS_MAC_MODEL_PROVIDER ? 'Loaded' : 'Installed'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{model.description}</p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">{model.size}</span>
              </div>
            </label>
          ))}
        </div>
      )}

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <span>{actionError}</span>
          <Button variant="ghost" size="sm" onClick={clearActionError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {actionNotice ? (
        <div
          className={`mt-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
            actionNotice.tone === 'success'
              ? 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300'
              : 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
          }`}
        >
          <span>{actionNotice.message}</span>
          <Button variant="ghost" size="sm" onClick={clearActionNotice}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {!IS_MAC_MODEL_PROVIDER && !hasModels && downloadingModel && downloadProgress ? (
        <ModelDownloadProgressCard progress={downloadProgress} className="mt-5" />
      ) : null}

      {!hasModels ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          {IS_MAC_MODEL_PROVIDER ? (
            <Button variant="outline" onClick={() => void openProviderApp()} disabled={isOpeningDownload}>
              {isOpeningDownload ? 'Opening Engine Guide...' : 'Open Engine Guide'}
            </Button>
          ) : null}
          <Button onClick={() => void handleDownload()} disabled={Boolean(downloadingModel) || isInstallingRecommendedModel}>
            {isInstallingRecommendedModel
              ? IS_MAC_MODEL_PROVIDER
                ? 'Checking Direct Engine...'
                : 'Installing Recommended Model...'
              : downloadingModel
                ? `Downloading ${getModelDisplayName(downloadingModel)}...`
                : IS_MAC_MODEL_PROVIDER
                  ? 'Confirm Gemma 4 In Engine'
                  : selectedModel === DEFAULT_FLOOR_MODEL
                    ? `Download ${getModelDisplayName(DEFAULT_FLOOR_MODEL)} (Recommended)`
                    : `Download ${getModelDisplayName(selectedModel)}`}
          </Button>
        </div>
      ) : null}
    </StepShell>
  );
}

function StepShell({
  eyebrow,
  title,
  description,
  children,
  onBack,
  onNext,
  nextDisabled,
  backLabel,
  nextLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  backLabel: string;
  nextLabel: string;
}) {
  return (
    <div>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>
      </div>

      <div className="mt-8">{children}</div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          {backLabel}
        </Button>
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
