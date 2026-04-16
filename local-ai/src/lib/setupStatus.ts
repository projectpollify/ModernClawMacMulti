import { APP_DISPLAY_NAME, IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_NAME } from '@/lib/providerConfig';
import type { MemoryFile } from '@/services/memory';
import type { EngineStatus, Model } from '@/services/engine';
import type { AppSettings } from '@/types/settings';
import type { VoiceInputStatus, VoiceOutputStatus } from '@/types/voice';

export type SetupItemState = 'ready' | 'attention' | 'checking' | 'optional';
export type SetupNextStepId = 'checking' | 'engine' | 'model' | 'memory' | 'ready';

export interface SetupChecklistItem {
  id: string;
  label: string;
  detail: string;
  state: SetupItemState;
  optional?: boolean;
  notes?: string[];
}

export interface SetupChecklistSummary {
  requiredReady: number;
  requiredTotal: number;
  optionalReady: number;
  optionalTotal: number;
}

export interface SetupNextStep {
  id: SetupNextStepId;
  title: string;
  detail: string;
}

interface BuildSetupChecklistArgs {
  settings: AppSettings;
  hasLoadedSettings: boolean;
  engineStatus: EngineStatus | null;
  models: Model[];
  modelError: string | null;
  memoryBasePath: string | null;
  soul: MemoryFile | null;
  user: MemoryFile | null;
  memory: MemoryFile | null;
  memoryLoading: boolean;
  memoryError: string | null;
  outputStatus: VoiceOutputStatus | null;
  inputStatus: VoiceInputStatus | null;
  isCheckingOutput: boolean;
  isCheckingInput: boolean;
  voiceError: string | null;
}

export function buildSetupChecklist({
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
}: BuildSetupChecklistArgs): {
  requiredItems: SetupChecklistItem[];
  optionalItems: SetupChecklistItem[];
  summary: SetupChecklistSummary;
  nextStep: SetupNextStep;
} {
  const missingFiles = [
    !soul?.exists ? 'SOUL.md' : null,
    !user?.exists ? 'USER.md' : null,
    !memory?.exists ? 'MEMORY.md' : null,
  ].filter((value): value is string => Boolean(value));

  const requiredItems: SetupChecklistItem[] = [
    buildEngineItem(engineStatus, modelError),
    buildModelItem(engineStatus, models, modelError),
    buildMemoryItem(memoryBasePath, missingFiles, memoryLoading, memoryError),
  ];

  const optionalItems: SetupChecklistItem[] = [
    buildVoiceOutputItem(settings, hasLoadedSettings, outputStatus, isCheckingOutput, voiceError),
    buildVoiceInputItem(settings, hasLoadedSettings, inputStatus, isCheckingInput, voiceError),
  ];

  const summary: SetupChecklistSummary = {
    requiredReady: requiredItems.filter((item) => item.state === 'ready').length,
    requiredTotal: requiredItems.length,
    optionalReady: optionalItems.filter((item) => item.state === 'ready').length,
    optionalTotal: optionalItems.length,
  };

  const nextStep = buildNextStep({
    engineStatus,
    models,
    memoryBasePath,
    missingFiles,
    memoryLoading,
    summary,
  });

  return {
    requiredItems,
    optionalItems,
    summary,
    nextStep,
  };
}

function buildNextStep({
  engineStatus,
  models,
  memoryBasePath,
  missingFiles,
  memoryLoading,
  summary,
}: {
  engineStatus: EngineStatus | null;
  models: Model[];
  memoryBasePath: string | null;
  missingFiles: string[];
  memoryLoading: boolean;
  summary: SetupChecklistSummary;
}): SetupNextStep {
  if (!engineStatus || (memoryLoading && !memoryBasePath)) {
    return {
      id: 'checking',
      title: 'Checking this machine',
      detail: `${APP_DISPLAY_NAME} is still confirming local services and workspace files.`,
    };
  }

  if (!engineStatus.running) {
    return {
      id: 'engine',
      title: IS_MAC_MODEL_PROVIDER ? 'Get the direct engine serving first' : 'Get the engine running first',
      detail: IS_MAC_MODEL_PROVIDER
        ? `Start a local llama.cpp server on port 8080 and keep it running so ${APP_DISPLAY_NAME} can reach the model service.`
        : `Install the local engine if needed, then start it so ${APP_DISPLAY_NAME} can reach the model service.`,
    };
  }

  if (models.length === 0) {
    return {
      id: 'model',
      title: IS_MAC_MODEL_PROVIDER ? 'Expose the recommended model' : 'Install the recommended model',
      detail: IS_MAC_MODEL_PROVIDER
        ? 'Once the direct engine is serving, expose a Gemma 4 model there so chat is ready right away.'
        : 'Once the engine is up, install a supported Gemma 4 model so chat is ready right away.',
    };
  }

  if (!memoryBasePath || missingFiles.length > 0) {
    return {
      id: 'memory',
      title: 'Initialize the workspace files',
      detail: 'Create SOUL.md, USER.md, and MEMORY.md so the base workspace is ready for first use.',
    };
  }

  if (summary.requiredReady === summary.requiredTotal) {
    return {
      id: 'ready',
      title: 'Core setup is ready',
      detail: 'You can start chatting now. Voice features can wait until later if you want to keep setup simple.',
    };
  }

  return {
    id: 'checking',
    title: 'Refreshing setup state',
    detail: `${APP_DISPLAY_NAME} is reconciling the current machine state.`,
  };
}

function buildEngineItem(engineStatus: EngineStatus | null, modelError: string | null): SetupChecklistItem {
  if (!engineStatus) {
    return {
      id: 'engine',
      label: MODEL_PROVIDER_NAME,
      detail: IS_MAC_MODEL_PROVIDER
        ? 'Checking whether the direct engine is serving on port 8080.'
        : 'Checking whether the local engine is available on this machine.',
      state: 'checking',
    };
  }

  if (engineStatus.running) {
    return {
      id: 'engine',
      label: MODEL_PROVIDER_NAME,
      detail: engineStatus.version
        ? `Running and ready. Detected version ${engineStatus.version}.`
        : 'Running and ready for local model requests.',
      state: 'ready',
    };
  }

  return {
    id: 'engine',
    label: MODEL_PROVIDER_NAME,
    detail: IS_MAC_MODEL_PROVIDER
      ? `${APP_DISPLAY_NAME} needs a local llama.cpp server on port 8080 before chat can work.`
      : `${APP_DISPLAY_NAME} needs the local engine running before chat can work.`,
    state: 'attention',
    notes: [
      engineStatus.error ??
        modelError ??
        (IS_MAC_MODEL_PROVIDER
          ? 'Start a local llama.cpp server on port 8080, then refresh setup checks.'
          : 'Install and start the local engine, then refresh setup checks.'),
    ],
  };
}

function buildModelItem(engineStatus: EngineStatus | null, models: Model[], modelError: string | null): SetupChecklistItem {
  if (!engineStatus) {
    return {
      id: 'model',
      label: 'Model Installed',
      detail: 'Checking for installed local models.',
      state: 'checking',
    };
  }

  if (!engineStatus.running) {
    return {
      id: 'model',
      label: 'Model Installed',
      detail: IS_MAC_MODEL_PROVIDER
        ? 'Start the direct engine server before checking which models are exposed there.'
        : 'Start the local engine before checking or installing local models.',
      state: 'attention',
    };
  }

  if (models.length > 0) {
    return {
      id: 'model',
      label: 'Model Installed',
      detail: `${models.length} model${models.length === 1 ? '' : 's'} available. Current choices include ${models
        .slice(0, 3)
        .map((model) => model.name)
        .join(', ')}${models.length > 3 ? ', and more.' : '.'}`,
      state: 'ready',
    };
  }

  return {
    id: 'model',
    label: 'Model Installed',
    detail: IS_MAC_MODEL_PROVIDER
      ? 'Expose at least one Gemma 4 model through the direct engine before first chat.'
      : 'Install at least one supported model before first chat.',
    state: 'attention',
    notes: modelError
      ? [modelError]
      : [
          IS_MAC_MODEL_PROVIDER
            ? 'Run llama.cpp with a supported Gemma 4 model, then refresh setup.'
            : 'Use onboarding or Settings to download a supported Gemma 4 model.',
        ],
  };
}

function buildMemoryItem(
  memoryBasePath: string | null,
  missingFiles: string[],
  memoryLoading: boolean,
  memoryError: string | null
): SetupChecklistItem {
  if (memoryLoading && !memoryBasePath) {
    return {
      id: 'memory',
      label: 'Workspace Files',
      detail: 'Initializing local memory files.',
      state: 'checking',
    };
  }

  if (memoryBasePath && missingFiles.length === 0) {
    return {
      id: 'memory',
      label: 'Workspace Files',
      detail: `Workspace folder is ready at ${memoryBasePath}.`,
      state: 'ready',
    };
  }

  const notes = memoryError
    ? [memoryError]
    : missingFiles.length > 0
      ? [`Missing file${missingFiles.length === 1 ? '' : 's'}: ${missingFiles.join(', ')}`]
      : ['Initialize the workspace memory files before first use.'];

  return {
    id: 'memory',
    label: 'Workspace Files',
    detail: `${APP_DISPLAY_NAME} needs SOUL.md, USER.md, and MEMORY.md in the active workspace.`,
    state: 'attention',
    notes,
  };
}

function buildVoiceOutputItem(
  settings: AppSettings,
  hasLoadedSettings: boolean,
  outputStatus: VoiceOutputStatus | null,
  isCheckingOutput: boolean,
  voiceError: string | null
): SetupChecklistItem {
  if (!hasLoadedSettings) {
    return {
      id: 'voice-output',
      label: 'Voice Output',
      detail: 'Loading voice settings.',
      state: 'checking',
      optional: true,
    };
  }

  if (!settings.enableVoiceOutput) {
    return {
      id: 'voice-output',
      label: 'Voice Output',
      detail: 'Optional feature. Turn it on later if you want spoken replies.',
      state: 'optional',
      optional: true,
    };
  }

  if (isCheckingOutput || !outputStatus) {
    return {
      id: 'voice-output',
      label: 'Voice Output',
      detail: 'Checking Piper and the selected voice model.',
      state: 'checking',
      optional: true,
    };
  }

  if (outputStatus.available) {
    return {
      id: 'voice-output',
      label: 'Voice Output',
      detail: 'Piper is ready to speak assistant replies on this machine.',
      state: 'ready',
      optional: true,
      notes: outputStatus.notes,
    };
  }

  return {
    id: 'voice-output',
    label: 'Voice Output',
    detail: 'Voice output is enabled, but Piper or the selected voice model is not ready yet.',
    state: 'attention',
    optional: true,
    notes: voiceError ? [voiceError] : outputStatus.notes,
  };
}

function buildVoiceInputItem(
  settings: AppSettings,
  hasLoadedSettings: boolean,
  inputStatus: VoiceInputStatus | null,
  isCheckingInput: boolean,
  voiceError: string | null
): SetupChecklistItem {
  if (!hasLoadedSettings) {
    return {
      id: 'voice-input',
      label: 'Voice Input',
      detail: 'Loading microphone transcription settings.',
      state: 'checking',
      optional: true,
    };
  }

  if (!settings.enableVoiceInput) {
    return {
      id: 'voice-input',
      label: 'Voice Input',
      detail: 'Optional feature. Turn it on later if you want microphone transcription.',
      state: 'optional',
      optional: true,
    };
  }

  if (isCheckingInput || !inputStatus) {
    return {
      id: 'voice-input',
      label: 'Voice Input',
      detail: 'Checking Whisper and the selected transcription model.',
      state: 'checking',
      optional: true,
    };
  }

  if (inputStatus.available) {
    return {
      id: 'voice-input',
      label: 'Voice Input',
      detail: 'Whisper is ready to transcribe microphone input on this machine.',
      state: 'ready',
      optional: true,
      notes: inputStatus.notes,
    };
  }

  return {
    id: 'voice-input',
    label: 'Voice Input',
    detail: 'Voice input is enabled, but Whisper or the selected model is not ready yet.',
    state: 'attention',
    optional: true,
    notes: voiceError ? [voiceError] : inputStatus.notes,
  };
}
