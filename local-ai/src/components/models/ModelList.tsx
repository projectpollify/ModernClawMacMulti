import { ModelCard } from './ModelCard';
import { ModelDownloader } from './ModelDownloader';
import { Button } from '@/components/ui/Button';
import { APP_DISPLAY_NAME, IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_NAME } from '@/lib/providerConfig';
import { useModelStore } from '@/stores/modelStore';

export function ModelList() {
  const models = useModelStore((state) => state.models);
  const isLoading = useModelStore((state) => state.isLoading);
  const engineStatus = useModelStore((state) => state.engineStatus);
  const error = useModelStore((state) => state.error);
  const clearError = useModelStore((state) => state.clearError);
  const refresh = useModelStore((state) => state.refresh);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Model Management</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {IS_MAC_MODEL_PROVIDER
                ? `Choose the active model currently exposed by ${MODEL_PROVIDER_NAME} for ${APP_DISPLAY_NAME}.`
                : 'Choose the active model, download new ones, and prune what you do not need.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>

        {!engineStatus?.running ? (
          <div className="mb-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700">
            {IS_MAC_MODEL_PROVIDER
              ? 'The direct engine is not serving on port 8080. Start llama.cpp and expose a model there, then refresh.'
              : 'The engine is not running. Start the engine to manage local models.'}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
            <span>{error}</span>
            <button onClick={clearError} className="rounded-md px-2 py-1 hover:bg-red-500/10">
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="mb-8 rounded-3xl border border-border bg-background/70 p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {IS_MAC_MODEL_PROVIDER ? 'Direct Engine Setup' : 'Download'}
          </h3>
          <ModelDownloader />
        </section>

        <section className="rounded-3xl border border-border bg-background/70 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Installed Models
            </h3>
            <span className="text-sm text-muted-foreground">{models.length}</span>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading models...</p>
          ) : models.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {IS_MAC_MODEL_PROVIDER
                ? 'No models are currently exposed by the direct engine. Start llama.cpp with a model to get started.'
                : 'No models installed yet. Download one above to get started.'}
            </p>
          ) : (
            <div className="grid gap-4">
              {models.map((model) => (
                <ModelCard key={model.name} model={model} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
