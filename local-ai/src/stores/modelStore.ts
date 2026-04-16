import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolvePreferredModelName } from '@/lib/providerConfig';
import { DEFAULT_FLOOR_MODEL } from '@/lib/voiceCatalog';
import { engineApi, type Model, type ModelPullProgress, type EngineStatus } from '@/services/engine';

export interface ModelDownloadProgress {
  model: string;
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
  done: boolean;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface ModelState {
  models: Model[];
  currentModel: string | null;
  engineStatus: EngineStatus | null;
  isLoading: boolean;
  downloadingModel: string | null;
  downloadProgress: ModelDownloadProgress | null;
  error: string | null;
  checkStatus: () => Promise<void>;
  loadModels: () => Promise<void>;
  setCurrentModel: (name: string | null) => void;
  downloadModel: (name: string) => Promise<void>;
  deleteModel: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      models: [],
      currentModel: DEFAULT_FLOOR_MODEL,
      engineStatus: null,
      isLoading: false,
      downloadingModel: null,
      downloadProgress: null,
      error: null,

      checkStatus: async () => {
        try {
          const status = await engineApi.checkStatus();
          set({ engineStatus: status, error: null });

          if (status.running) {
            await get().loadModels();
          }
        } catch (error) {
          set({ error: String(error), engineStatus: { running: false, error: String(error) } });
        }
      },

      loadModels: async () => {
        set({ isLoading: true });

        try {
          const models = await engineApi.listModels();
          const currentModel = get().currentModel;
          const nextCurrentModel = resolvePreferredModelName(
            currentModel ?? DEFAULT_FLOOR_MODEL,
            models.map((model) => model.name)
          );

          set({
            models,
            currentModel: nextCurrentModel,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({ error: String(error), isLoading: false });
        }
      },

      setCurrentModel: (name) => {
        set({ currentModel: name });
      },

      downloadModel: async (name) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
          return;
        }

        set({
          downloadingModel: trimmedName,
          downloadProgress: {
            model: trimmedName,
            status: 'Preparing download...',
            done: false,
          },
          error: null,
        });

        try {
          await engineApi.pullModel(trimmedName, (progress: ModelPullProgress) => {
            set({
              downloadProgress: mapPullProgress(progress),
            });
          });

          let installed = false;

          for (let attempt = 0; attempt < 5; attempt += 1) {
            await get().loadModels();

            if (get().models.some((model) => model.name === trimmedName)) {
              installed = true;
              break;
            }

            set({
              downloadProgress: {
                model: trimmedName,
                status: 'Verifying installed model...',
                done: false,
              },
            });

            await delay(1200);
          }

          if (!installed) {
            set({
              error:
                `ModernClaw could not confirm that ${trimmedName} is available yet. ` +
                'If you are using ModernClawMac, make sure the direct engine can see that GGUF model and refresh again.',
            });
            return;
          }

          set((state) => ({
            currentModel: state.currentModel ?? trimmedName,
          }));
        } catch (error) {
          set({ error: String(error) });
        } finally {
          set({ downloadingModel: null, downloadProgress: null });
        }
      },

      deleteModel: async (name) => {
        try {
          await engineApi.deleteModel(name);
          await get().loadModels();

          if (get().currentModel === name) {
            const remaining = get().models.filter((model) => model.name !== name);
            set({ currentModel: remaining[0]?.name ?? null });
          }
        } catch (error) {
          set({ error: String(error) });
        }
      },

      refresh: async () => {
        await get().checkStatus();
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'model-storage',
      partialize: (state) => ({ currentModel: state.currentModel }),
    }
  )
);

function mapPullProgress(progress: ModelPullProgress): ModelDownloadProgress {
  const percent =
    typeof progress.completed === 'number' &&
    typeof progress.total === 'number' &&
    progress.total > 0
      ? Math.max(0, Math.min(100, Math.round((progress.completed / progress.total) * 100)))
      : undefined;

  return {
    model: progress.model,
    status: progress.status,
    digest: progress.digest,
    total: progress.total,
    completed: progress.completed,
    percent,
    done: progress.done,
  };
}
