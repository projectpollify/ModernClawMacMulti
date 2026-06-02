import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSetupChecklist } from '@/lib/setupStatus';
import { useMemoryStore } from '@/stores/memoryStore';
import { useModelStore } from '@/stores/modelStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useVoiceStore } from '@/stores/voiceStore';

export function useSetupStatus() {
  const settings = useSettingsStore((state) => state.settings);
  const hasLoadedSettings = useSettingsStore((state) => state.hasLoaded);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  const models = useModelStore((state) => state.models);
  const engineStatus = useModelStore((state) => state.engineStatus);
  const refreshModels = useModelStore((state) => state.refresh);
  const modelError = useModelStore((state) => state.error);

  const initializeMemory = useMemoryStore((state) => state.initialize);
  const soul = useMemoryStore((state) => state.soul);
  const user = useMemoryStore((state) => state.user);
  const memory = useMemoryStore((state) => state.memory);
  const memoryBasePath = useMemoryStore((state) => state.basePath);
  const memoryLoading = useMemoryStore((state) => state.isLoading);
  const memoryError = useMemoryStore((state) => state.error);

  const outputStatus = useVoiceStore((state) => state.outputStatus);
  const inputStatus = useVoiceStore((state) => state.inputStatus);
  const isCheckingOutput = useVoiceStore((state) => state.isCheckingOutput);
  const isCheckingInput = useVoiceStore((state) => state.isCheckingInput);
  const voiceError = useVoiceStore((state) => state.error);
  const checkOutputStatus = useVoiceStore((state) => state.checkOutputStatus);
  const checkInputStatus = useVoiceStore((state) => state.checkInputStatus);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasRefetchedOnEngineReady = useRef(false);

  const runRefresh = async () => {
    setIsRefreshing(true);

    try {
      if (!hasLoadedSettings) {
        await loadSettings();
      }

      await Promise.all([
        refreshModels(),
        initializeMemory(),
        checkOutputStatus(),
        checkInputStatus(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedSettings || !engineStatus || !memoryBasePath || (!outputStatus && !isCheckingOutput) || (!inputStatus && !isCheckingInput)) {
      void runRefresh();
    }
  }, [
    hasLoadedSettings,
    inputStatus,
    isCheckingInput,
    isCheckingOutput,
    memoryBasePath,
    engineStatus,
    outputStatus,
  ]);

  // Re-fetch the model list once the engine finishes its (sometimes slow) cold
  // start. The initial setup check can complete while the engine is still
  // loading and record an empty model list. The effect above stops refreshing
  // once `engineStatus` is merely *present* (running or not), so without this
  // the list would never repopulate after the engine actually comes up —
  // leaving "Model Installed" stuck on missing, and chat gated, even though a
  // model is being served. The ref guard ensures we retry exactly once per
  // engine-ready transition, so an engine that genuinely has no models can't
  // trigger a refresh loop.
  useEffect(() => {
    if (!engineStatus?.running) {
      // Engine isn't up (or went away): arm a fresh refetch for when it returns.
      hasRefetchedOnEngineReady.current = false;
      return;
    }

    if (models.length === 0 && !isRefreshing && !hasRefetchedOnEngineReady.current) {
      hasRefetchedOnEngineReady.current = true;
      void refreshModels();
    }
  }, [engineStatus, models.length, isRefreshing, refreshModels]);

  const checklist = useMemo(
    () =>
      buildSetupChecklist({
        settings,
        hasLoadedSettings,
        engineStatus,
        models,
        modelError,
        memoryBasePath,
        soul,
        user,
        memory,
        memoryLoading,
        memoryError,
        outputStatus,
        inputStatus,
        isCheckingOutput,
        isCheckingInput,
        voiceError,
      }),
    [
      hasLoadedSettings,
      inputStatus,
      isCheckingInput,
      isCheckingOutput,
      memory,
      memoryBasePath,
      memoryError,
      memoryLoading,
      modelError,
      models,
      engineStatus,
      outputStatus,
      settings,
      soul,
      user,
      voiceError,
    ]
  );

  return {
    ...checklist,
    isRefreshing,
    runRefresh,
    settings,
    memoryBasePath,
    isCoreReady: checklist.summary.requiredReady === checklist.summary.requiredTotal,
  };
}
