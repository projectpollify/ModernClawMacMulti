import { useState } from 'react';
import { IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_NAME } from '@/lib/providerConfig';
import { DEFAULT_FLOOR_MODEL, LIGHTWEIGHT_FLOOR_MODEL } from '@/lib/voiceCatalog';
import { setupApi } from '@/services/setup';
import { useMemoryStore } from '@/stores/memoryStore';
import { useModelStore } from '@/stores/modelStore';

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type ActionNoticeTone = 'success' | 'info';

export function useSetupActions() {
  const checkStatus = useModelStore((state) => state.checkStatus);
  const downloadModel = useModelStore((state) => state.downloadModel);
  const loadModels = useModelStore((state) => state.loadModels);
  const downloadingModel = useModelStore((state) => state.downloadingModel);
  const initializeMemory = useMemoryStore((state) => state.initialize);
  const memoryBasePath = useMemoryStore((state) => state.basePath);

  const [isOpeningDownload, setIsOpeningDownload] = useState(false);
  const [isStartingEngine, setIsStartingEngine] = useState(false);
  const [isInstallingRecommendedModel, setIsInstallingRecommendedModel] = useState(false);
  const [isInitializingWorkspace, setIsInitializingWorkspace] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ tone: ActionNoticeTone; message: string } | null>(null);

  const resetFeedback = () => {
    setActionError(null);
    setActionNotice(null);
  };

  const openProviderApp = async () => {
    setIsOpeningDownload(true);
    resetFeedback();

    try {
      await setupApi.openProviderApp();
      setActionNotice({
        tone: 'info',
        message: IS_MAC_MODEL_PROVIDER
          ? 'Opened the direct-engine reference. For now, start a local llama.cpp server on port 8080, make sure a model is loaded there, then refresh setup.'
          : 'Opened the engine download page. Install it there, then come back here and click Start Engine.',
      });
    } catch (error) {
      setActionError(String(error));
    } finally {
      setIsOpeningDownload(false);
    }
  };

  const startEngine = async () => {
    setIsStartingEngine(true);
    resetFeedback();

    try {
      await setupApi.startEngine();

      if (IS_MAC_MODEL_PROVIDER) {
        setActionNotice({
          tone: 'info',
          message: `Starting ${MODEL_PROVIDER_NAME} with the saved llama.cpp executable and GGUF model path.`,
        });
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await delay(1200);
        await checkStatus();

        if (useModelStore.getState().engineStatus?.running) {
          setActionNotice({
            tone: 'success',
            message: IS_MAC_MODEL_PROVIDER
              ? `${MODEL_PROVIDER_NAME} is responding. The next step is making sure either ${DEFAULT_FLOOR_MODEL} or ${LIGHTWEIGHT_FLOOR_MODEL} is available there.`
              : 'The engine is responding. The next step is installing the recommended model.',
          });
          return true;
        }
      }

      setActionError(
        IS_MAC_MODEL_PROVIDER
          ? `The direct engine is not responding yet. Start a local llama.cpp server on port 8080, then make sure either ${DEFAULT_FLOOR_MODEL} or ${LIGHTWEIGHT_FLOOR_MODEL} is available before refreshing setup.`
          : 'Tried to start the engine, but it is not responding yet. If this is a fresh install, open the engine once and then refresh setup.'
      );
      return false;
    } catch (error) {
      setActionError(String(error));
      return false;
    } finally {
      setIsStartingEngine(false);
    }
  };

  const installRecommendedModel = async () => {
    setIsInstallingRecommendedModel(true);
    resetFeedback();

    try {
      if (IS_MAC_MODEL_PROVIDER) {
        await loadModels();
        const { models } = useModelStore.getState();

        if (!models.some((model) => [DEFAULT_FLOOR_MODEL, LIGHTWEIGHT_FLOOR_MODEL].includes(model.name))) {
          setActionError(
            `Expose either ${DEFAULT_FLOOR_MODEL} or ${LIGHTWEIGHT_FLOOR_MODEL} through the local llama.cpp server, then refresh setup here.`
          );
          return false;
        }

        setActionNotice({
          tone: 'success',
          message: 'The direct engine already exposes a standard Gemma 4 model. The next step is making sure the workspace files are ready.',
        });
        return true;
      }

      await downloadModel(DEFAULT_FLOOR_MODEL);
      await loadModels();

      const { error: modelError, models } = useModelStore.getState();
      if (modelError) {
        setActionError(modelError);
        return false;
      }

      const confirmed = models.some((model) => model.name === DEFAULT_FLOOR_MODEL);
      if (!confirmed) {
        setActionError(
          `${DEFAULT_FLOOR_MODEL} has not been confirmed in the installed model list yet. ` +
            'Give the engine a little more time, then refresh and try again.'
        );
        return false;
      }

      setActionNotice({
        tone: 'success',
        message: `${DEFAULT_FLOOR_MODEL} is installed and verified. The next step is making sure the workspace files are ready.`,
      });
      return true;
    } catch (error) {
      setActionError(String(error));
      return false;
    } finally {
      setIsInstallingRecommendedModel(false);
    }
  };

  const initializeWorkspace = async () => {
    setIsInitializingWorkspace(true);
    resetFeedback();

    try {
      await initializeMemory();

      const memoryError = useMemoryStore.getState().error;
      if (memoryError) {
        setActionError(memoryError);
        return false;
      }

      const nextBasePath = useMemoryStore.getState().basePath ?? memoryBasePath;
      setActionNotice({
        tone: 'success',
        message: nextBasePath
          ? `Workspace files are ready at ${nextBasePath}.`
          : 'Workspace files are ready.',
      });
      return true;
    } catch (error) {
      setActionError(String(error));
      return false;
    } finally {
      setIsInitializingWorkspace(false);
    }
  };

  return {
    openProviderApp,
    startEngine,
    installRecommendedModel,
    initializeWorkspace,
    isOpeningDownload,
    isStartingEngine,
    isInstallingRecommendedModel,
    isInitializingWorkspace,
    isDownloadingAnyModel: Boolean(downloadingModel),
    actionError,
    actionNotice,
    clearActionError: () => setActionError(null),
    clearActionNotice: () => setActionNotice(null),
  };
}
