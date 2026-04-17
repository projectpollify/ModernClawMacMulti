import { useState } from 'react';
import { ModelDownloadProgressCard } from '@/components/models/ModelDownloadProgressCard';
import { getModelDisplayName, IS_MAC_MODEL_PROVIDER } from '@/lib/providerConfig';
import { CURATED_FLOOR_MODELS } from '@/lib/voiceCatalog';
import { cn } from '@/lib/utils';
import { useModelStore } from '@/stores/modelStore';

export function ModelDownloader() {
  const [customModel, setCustomModel] = useState('');
  const downloadModel = useModelStore((state) => state.downloadModel);
  const downloadingModel = useModelStore((state) => state.downloadingModel);
  const downloadProgress = useModelStore((state) => state.downloadProgress);

  const handleDownload = (name: string) => {
    void downloadModel(name);
  };

  if (IS_MAC_MODEL_PROVIDER) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
          ModernClawMac reads whichever Gemma 4 GGUF models are available to the local direct engine. Start
          `llama-server` on port 8080, then make one of the standard lanes below available and come back here to refresh.
        </div>

        <div className="flex flex-wrap gap-2">
          {CURATED_FLOOR_MODELS.map((model) => (
            <div key={model.name} className="rounded-xl border border-border bg-background px-3 py-2 text-left text-sm">
              <div className="font-medium">{getModelDisplayName(model.name)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{model.description}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
        ModernClaw is currently tuned around the Gemma 4 family. Start with the primary lane for the strongest local quality, or use the lighter 2B sibling when you want a smaller supported option on the same track.
      </div>

      <div className="flex flex-wrap gap-2">
        {CURATED_FLOOR_MODELS.map((model) => (
          <button
            key={model.name}
            onClick={() => handleDownload(model.name)}
            disabled={Boolean(downloadingModel)}
            className={cn(
              'rounded-xl border border-border bg-background px-3 py-2 text-left text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
            title={model.description}
          >
            <span className="font-medium">{getModelDisplayName(model.name)}</span>
            <span className="ml-2 text-muted-foreground">{model.size}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customModel}
          onChange={(event) => setCustomModel(event.target.value)}
          placeholder="Optional custom model, e.g. llama3.1:8b"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50"
        />
        <button
          onClick={() => handleDownload(customModel)}
          disabled={!customModel.trim() || Boolean(downloadingModel)}
          className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download
        </button>
      </div>

      {downloadingModel && downloadProgress ? <ModelDownloadProgressCard progress={downloadProgress} /> : null}
    </div>
  );
}
