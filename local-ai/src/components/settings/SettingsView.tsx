import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { ModelCard } from '@/components/models/ModelCard';
import { ModelDownloader } from '@/components/models/ModelDownloader';
import { SetupStatusPanel } from '@/components/setup/SetupStatusPanel';
import { APP_DISPLAY_NAME, getModelDisplayName, IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_NAME } from '@/lib/providerConfig';
import { CURATED_FLOOR_MODELS, CURATED_PIPER_VOICES, DEFAULT_FLOOR_MODEL } from '@/lib/voiceCatalog';
import { getEffectiveVoiceSettings } from '@/lib/voiceSettings';
import { getDefaultVoicePaths } from '@/lib/voicePaths';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/stores/agentStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useModelStore } from '@/stores/modelStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useThemeStore } from '@/stores/themeStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { historyApi } from '@/services/history';
import { memoryApi } from '@/services/memory';
import type { AgentVoiceSettings, MessageFeedbackSummary, Theme } from '@/types';

const CONTEXT_WINDOW_OPTIONS = [2048, 4096, 8192, 16384, 32768, 65536, 131072];
const WHISPER_LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
];

export function SettingsView() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const updateActiveAgentDefaultModel = useAgentStore((state) => state.updateActiveAgentDefaultModel);
  const updateActiveAgentVoiceSettings = useAgentStore((state) => state.updateActiveAgentVoiceSettings);
  const { settings, isLoading, error, updateSetting, resetSettings, clearError } = useSettingsStore();
  const currentTheme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const models = useModelStore((state) => state.models);
  const currentModel = useModelStore((state) => state.currentModel);
  const setCurrentModel = useModelStore((state) => state.setCurrentModel);
  const engineStatus = useModelStore((state) => state.engineStatus);
  const refreshModels = useModelStore((state) => state.refresh);
  const loadConversations = useConversationStore((state) => state.loadConversations);
  const clearConversations = useConversationStore((state) => state.clearConversations);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const outputStatus = useVoiceStore((state) => state.outputStatus);
  const inputStatus = useVoiceStore((state) => state.inputStatus);
  const isCheckingOutput = useVoiceStore((state) => state.isCheckingOutput);
  const isCheckingInput = useVoiceStore((state) => state.isCheckingInput);
  const isSpeakingVoice = useVoiceStore((state) => state.isSpeaking);
  const voiceError = useVoiceStore((state) => state.error);
  const checkOutputStatus = useVoiceStore((state) => state.checkOutputStatus);
  const checkInputStatus = useVoiceStore((state) => state.checkInputStatus);
  const speakMessage = useVoiceStore((state) => state.speakMessage);
  const clearVoiceError = useVoiceStore((state) => state.clearError);
  const [feedbackSummary, setFeedbackSummary] = useState<MessageFeedbackSummary | null>(null);
  const [isLoadingFeedbackSummary, setIsLoadingFeedbackSummary] = useState(false);

  const loadFeedbackSummary = async () => {
    if (!settings.saveConversationHistory) {
      setFeedbackSummary(null);
      return;
    }

    setIsLoadingFeedbackSummary(true);
    try {
      const summary = await historyApi.getMessageFeedbackSummary();
      setFeedbackSummary(summary);
    } catch {
      setFeedbackSummary(null);
    } finally {
      setIsLoadingFeedbackSummary(false);
    }
  };

  useEffect(() => {
    if (!engineStatus) {
      void refreshModels();
    }
  }, [engineStatus, refreshModels]);

  useEffect(() => {
    void loadFeedbackSummary();
  }, [settings.saveConversationHistory]);

  const effectiveVoiceSettings = useMemo(
    () => getEffectiveVoiceSettings(settings, activeAgent),
    [settings, activeAgent]
  );

  const voiceDefaultsForActiveBrain = useMemo(
    () => getDefaultVoicePaths(settings.memoryPath || '', effectiveVoiceSettings.piperVoicePreset),
    [settings.memoryPath, effectiveVoiceSettings.piperVoicePreset]
  );

  useEffect(() => {
    if (
      effectiveVoiceSettings.enableVoiceOutput ||
      effectiveVoiceSettings.piperExecutablePath ||
      effectiveVoiceSettings.piperModelPath
    ) {
      void checkOutputStatus();
    }
  }, [
    effectiveVoiceSettings.enableVoiceOutput,
    effectiveVoiceSettings.piperExecutablePath,
    effectiveVoiceSettings.piperModelPath,
    checkOutputStatus,
  ]);

  useEffect(() => {
    if (
      effectiveVoiceSettings.enableVoiceInput ||
      effectiveVoiceSettings.whisperExecutablePath ||
      effectiveVoiceSettings.whisperModelPath
    ) {
      void checkInputStatus();
    }
  }, [
    effectiveVoiceSettings.enableVoiceInput,
    effectiveVoiceSettings.whisperExecutablePath,
    effectiveVoiceSettings.whisperModelPath,
    checkInputStatus,
  ]);

  const modelOptions = useMemo(() => {
    const installedNames = new Set(models.map((model) => model.name));
    const preferred = CURATED_FLOOR_MODELS.map((model) => ({
      name: model.name,
      label: installedNames.has(model.name)
        ? `${getModelDisplayName(model.name)} (${model.recommended ? 'primary lane' : 'lighter lane'}, installed)`
        : `${getModelDisplayName(model.name)} (${model.recommended ? 'primary lane' : 'lighter lane'})`,
    }));
    const seen = new Set<string>();

    return [...preferred, ...models.map((model) => ({ name: model.name, label: getModelDisplayName(model.name) }))].filter((option) => {
      if (seen.has(option.name)) {
        return false;
      }

      seen.add(option.name);
      return true;
    });
  }, [models]);

  const buildVoiceUpdate = (overrides: Partial<AgentVoiceSettings>): AgentVoiceSettings => ({
    enableVoiceOutput: overrides.enableVoiceOutput ?? effectiveVoiceSettings.enableVoiceOutput,
    piperVoicePreset: overrides.piperVoicePreset ?? effectiveVoiceSettings.piperVoicePreset,
    piperModelPath: overrides.piperModelPath ?? effectiveVoiceSettings.piperModelPath,
    enableVoiceInput: overrides.enableVoiceInput ?? effectiveVoiceSettings.enableVoiceInput,
    whisperModelPath: overrides.whisperModelPath ?? effectiveVoiceSettings.whisperModelPath,
    whisperLanguage: overrides.whisperLanguage ?? effectiveVoiceSettings.whisperLanguage,
  });

  const handleThemeChange = async (nextTheme: Theme) => {
    const previousTheme = currentTheme;
    setTheme(nextTheme);
    const didPersist = await updateSetting('theme', nextTheme);

    if (!didPersist) {
      setTheme(previousTheme);
    }
  };

  const handleWorkspaceModelChange = async (value: string) => {
    const previousModel = currentModel;
    const nextModel = value || null;
    setCurrentModel(nextModel);
    try {
      await updateActiveAgentDefaultModel(nextModel);
    } catch {
      setCurrentModel(previousModel);
    }
  };

  const handleHistoryToggle = async (value: boolean) => {
    await updateSetting('saveConversationHistory', value);

    if (useSettingsStore.getState().settings.saveConversationHistory) {
      await loadConversations();
    } else {
      clearConversations();
    }
  };

  const handlePiperVoicePresetChange = async (value: string) => {
    const nextDefaults = getDefaultVoicePaths(settings.memoryPath || '', value);
    await updateActiveAgentVoiceSettings(
      buildVoiceUpdate({
        piperVoicePreset: value,
        piperModelPath: nextDefaults.piperModelPath,
      })
    );
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all settings to defaults?')) {
      return;
    }

    const didReset = await resetSettings();
    if (!didReset) {
      return;
    }

    setTheme('system');
    setCurrentModel(DEFAULT_FLOOR_MODEL);
    await updateActiveAgentDefaultModel(DEFAULT_FLOOR_MODEL);
    await refreshModels();
    await loadConversations();
  };

  const openMemoryFolder = async () => {
    try {
      await memoryApi.openFolder();
    } catch {
      window.alert(`Unable to open the memory folder.\n\n${settings.memoryPath}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Control Room</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Configure appearance, model defaults, storage behavior, privacy, and voice for your main {APP_DISPLAY_NAME} workspace. Joe Support stays built in for setup and troubleshooting without exposing full multi-brain management.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshModels()}>
            Refresh Models
          </Button>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {isLoading ? <p className="text-sm text-muted-foreground">Loading settings...</p> : null}

        <SetupStatusPanel description="Use this as the single readiness view for install checks, troubleshooting, and first-run confidence." />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <div className="space-y-8">
            <SettingsSection title="Appearance">
              <SettingRow label="Theme" description="Choose light, dark, or follow your system setting.">
                <select
                  value={settings.theme}
                  onChange={(event) => void handleThemeChange(event.target.value as Theme)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Model">
              <SettingRow
                label="Workspace Model"
                description="Choose the default model for this workspace. The header model picker and the model tools below update the same saved preference."
              >
                <select
                  value={activeAgent?.defaultModel ?? currentModel ?? ''}
                  onChange={(event) => void handleWorkspaceModelChange(event.target.value)}
                  className="max-w-[320px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {modelOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow
                label="Context Window"
                description="Controls how much memory and history are packed into each prompt. Gemma 4 stays happiest when this remains moderate unless you are intentionally testing longer contexts."
              >
                <select
                  value={settings.contextWindowSize}
                  onChange={(event) => void updateSetting('contextWindowSize', Number(event.target.value))}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {CONTEXT_WINDOW_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size.toLocaleString()} tokens
                    </option>
                  ))}
                </select>
              </SettingRow>

              {IS_MAC_MODEL_PROVIDER ? (
                <>
                  <SettingRow
                    label="llama-server Executable"
                    description="Path to the local llama.cpp server binary. If left blank, ModernClawMac will try common Homebrew locations first."
                    stackOnMobile
                  >
                    <input
                      type="text"
                      value={settings.directEngineExecutablePath}
                      onChange={(event) => void updateSetting('directEngineExecutablePath', event.target.value)}
                      placeholder="/opt/homebrew/bin/llama-server"
                      className="w-full min-w-[260px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                  </SettingRow>

                  <SettingRow
                    label="GGUF Model Path"
                    description="Path to the GGUF model file the direct engine should serve when you click Start Engine."
                    stackOnMobile
                  >
                    <input
                      type="text"
                      value={settings.directEngineModelPath}
                      onChange={(event) => void updateSetting('directEngineModelPath', event.target.value)}
                      placeholder="/path/to/model.gguf"
                      className="w-full min-w-[260px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                  </SettingRow>

                  <SettingRow
                    label="Engine Port"
                    description="The current direct-engine prototype expects llama.cpp to serve its OpenAI-compatible API on port 8080."
                  >
                    <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                      http://127.0.0.1:8080
                    </div>
                  </SettingRow>
                </>
              ) : null}
            </SettingsSection>

            <SettingsSection title="Behavior">
              <SettingRow
                label="Stream Responses"
                description="Show the assistant response token-by-token while it is generating."
              >
                <Toggle
                  checked={settings.streamResponses}
                  onChange={(value) => void updateSetting('streamResponses', value)}
                />
              </SettingRow>

              <SettingRow
                label="Send on Enter"
                description="Press Enter to send. Turn this off if you prefer Ctrl/Cmd+Enter."
              >
                <Toggle
                  checked={settings.sendOnEnter}
                  onChange={(value) => void updateSetting('sendOnEnter', value)}
                />
              </SettingRow>

              <SettingRow
                label="Show Token Count"
                description="Display approximate token usage on chat bubbles for quick prompt-budget visibility."
              >
                <Toggle
                  checked={settings.showTokenCount}
                  onChange={(value) => void updateSetting('showTokenCount', value)}
                />
              </SettingRow>

              <SettingRow
                label="Show Response Metrics"
                description="Display context usage, tokens per second, output tokens, duration, and stop reason beneath assistant replies."
              >
                <Toggle
                  checked={settings.showResponseMetrics}
                  onChange={(value) => void updateSetting('showResponseMetrics', value)}
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Voice Output">
              <SettingRow
                label="Enable Voice Output"
                description="Turn on local text-to-speech so assistant replies can be spoken through Piper in this workspace."
              >
                <Toggle
                  checked={effectiveVoiceSettings.enableVoiceOutput}
                  onChange={(value) => void updateActiveAgentVoiceSettings(buildVoiceUpdate({ enableVoiceOutput: value }))}
                />
              </SettingRow>

              <SettingRow
                label="Selected Voice"
                description="Choose a curated voice for this workspace while still using the shared machine-level Piper install."
              >
                <select
                  value={effectiveVoiceSettings.piperVoicePreset}
                  onChange={(event) => void handlePiperVoicePresetChange(event.target.value)}
                  className="max-w-[260px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {CURATED_PIPER_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow
                label="Piper Executable"
                description={`${APP_DISPLAY_NAME} looks here first for the local Piper binary. This stays machine-level by default.`}
                stackOnMobile
              >
                <input
                  type="text"
                  value={settings.piperExecutablePath}
                  onChange={(event) => void updateSetting('piperExecutablePath', event.target.value)}
                  placeholder={voiceDefaultsForActiveBrain.piperExecutablePath}
                  className="w-full min-w-[260px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </SettingRow>

              <SettingRow
                label="Piper Voice Model"
                description="This workspace uses the matching Piper voice model file. Choosing a curated voice above points to the expected path automatically."
                stackOnMobile
              >
                <input
                  type="text"
                  value={effectiveVoiceSettings.piperModelPath}
                  onChange={(event) => void updateActiveAgentVoiceSettings(buildVoiceUpdate({ piperModelPath: event.target.value }))}
                  placeholder={voiceDefaultsForActiveBrain.piperModelPath}
                  className="w-full min-w-[260px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </SettingRow>

              <SettingRow
                label="Voice Output Status"
                description="Check whether Piper and the selected voice model are available for this workspace on this machine."
                stackOnMobile
              >
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => void checkOutputStatus()} disabled={isCheckingOutput}>
                    {isCheckingOutput ? 'Checking...' : 'Refresh Output Status'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void speakMessage('voice-test', `${APP_DISPLAY_NAME} voice output is configured and ready to test.`)}
                    disabled={!effectiveVoiceSettings.enableVoiceOutput || isSpeakingVoice}
                  >
                    {isSpeakingVoice ? 'Speaking...' : 'Test Voice'}
                  </Button>
                </div>
              </SettingRow>

              <VoiceStatusCard
                readyLabel="Voice output is ready."
                notReadyLabel="Voice output is not ready yet."
                executableLabel="Piper executable"
                modelLabel="Voice model"
                executableFound={outputStatus?.piperFound ?? false}
                modelFound={outputStatus?.modelFound ?? false}
                available={outputStatus?.available ?? false}
                notes={outputStatus?.notes ?? []}
                error={voiceError}
                onDismissError={clearVoiceError}
              />
            </SettingsSection>

            <SettingsSection title="Voice Input">
              <SettingRow
                label="Enable Voice Input"
                description="Turn on local speech-to-text so the microphone can transcribe into the composer through Whisper in this workspace."
              >
                <Toggle
                  checked={effectiveVoiceSettings.enableVoiceInput}
                  onChange={(value) => void updateActiveAgentVoiceSettings(buildVoiceUpdate({ enableVoiceInput: value }))}
                />
              </SettingRow>

              <SettingRow
                label="Whisper Executable"
                description={`${APP_DISPLAY_NAME} looks here first for whisper-cli.exe. This stays machine-level by default.`}
                stackOnMobile
              >
                <input
                  type="text"
                  value={settings.whisperExecutablePath}
                  onChange={(event) => void updateSetting('whisperExecutablePath', event.target.value)}
                  placeholder={voiceDefaultsForActiveBrain.whisperExecutablePath}
                  className="w-full min-w-[260px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </SettingRow>

              <SettingRow
                label="Whisper Model"
                description="Override this only if your workspace needs a different transcription model than the machine default."
                stackOnMobile
              >
                <input
                  type="text"
                  value={effectiveVoiceSettings.whisperModelPath}
                  onChange={(event) => void updateActiveAgentVoiceSettings(buildVoiceUpdate({ whisperModelPath: event.target.value }))}
                  placeholder={voiceDefaultsForActiveBrain.whisperModelPath}
                  className="w-full min-w-[260px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </SettingRow>

              <SettingRow
                label="Voice Input Language"
                description="Use auto-detect or lock Whisper to a language for faster, cleaner transcription in this workspace."
              >
                <select
                  value={effectiveVoiceSettings.whisperLanguage}
                  onChange={(event) => void updateActiveAgentVoiceSettings(buildVoiceUpdate({ whisperLanguage: event.target.value }))}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {WHISPER_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow
                label="Voice Input Status"
                description="Check whether Whisper and the selected transcription model are available for this workspace on this machine."
                stackOnMobile
              >
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => void checkInputStatus()} disabled={isCheckingInput}>
                    {isCheckingInput ? 'Checking...' : 'Refresh Input Status'}
                  </Button>
                </div>
              </SettingRow>

              <VoiceStatusCard
                readyLabel="Voice input is ready."
                notReadyLabel="Voice input is not ready yet."
                executableLabel="Whisper executable"
                modelLabel="Whisper model"
                executableFound={inputStatus?.whisperFound ?? false}
                modelFound={inputStatus?.modelFound ?? false}
                available={inputStatus?.available ?? false}
                notes={inputStatus?.notes ?? []}
              />
            </SettingsSection>

            <SettingsSection title="Privacy">
              <SettingRow
                label="Save Conversation History"
                description="Keep conversations in the local SQLite database so they survive restarts."
              >
                <Toggle checked={settings.saveConversationHistory} onChange={(value) => void handleHistoryToggle(value)} />
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Storage">
              <SettingRow
                label="Memory Folder"
                description="This is where SOUL.md, USER.md, MEMORY.md, logs, knowledge files, and the default voice tool folders live."
                stackOnMobile
                alignTop
              >
                <div className="flex w-full max-w-[540px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div
                    title={settings.memoryPath || 'Default'}
                    className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-secondary/75 px-4 py-2.5 text-secondary-foreground"
                  >
                    <code className="block truncate font-mono text-[12px] leading-5">
                      {settings.memoryPath || 'Default'}
                    </code>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void openMemoryFolder()}>
                    Open
                  </Button>
                </div>
              </SettingRow>
            </SettingsSection>

            <div className="border-t border-border pt-6">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={() => resetOnboarding()}>
                  Restart Onboarding
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleReset()}
                  className="border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-600"
                >
                  Reset All Settings
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <FeedbackSummaryCard
              summary={feedbackSummary}
              isLoading={isLoadingFeedbackSummary}
              historyEnabled={settings.saveConversationHistory}
              onRefresh={() => void loadFeedbackSummary()}
            />

            <section className="rounded-[2rem] border border-border/70 bg-[hsl(var(--panel-strong))] p-6 shadow-[var(--surface-shadow)] backdrop-blur-[18px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Model Management</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use the header model picker or the model cards below to save the current model for this workspace.
                  </p>
                </div>
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                  Active: {getModelDisplayName(currentModel) || 'None'}
                </span>
              </div>

              {!engineStatus?.running ? (
                <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700">
                  {IS_MAC_MODEL_PROVIDER
                    ? `${MODEL_PROVIDER_NAME} is not serving on port 8080. Start the local engine and load a model there to manage active models.`
                    : 'The engine is not running. Start it to manage installed models.'}
                </div>
              ) : null}

              <div className="mt-5 rounded-[1.6rem] border border-border/70 bg-background/80 p-4 shadow-[var(--surface-shadow-soft)]">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {IS_MAC_MODEL_PROVIDER ? 'Direct Engine Models' : 'Download'}
                </h3>
                <ModelDownloader />
              </div>

              <div className="mt-5 space-y-4">
                {models.length > 0 ? (
                  models.map((model) => <ModelCard key={model.name} model={model} />)
                ) : (
                  <div className="rounded-[1.6rem] border border-dashed border-border bg-background/70 p-5 text-sm text-muted-foreground">
                    {IS_MAC_MODEL_PROVIDER ? 'No compatible local GGUF models are currently available.' : 'No models installed yet.'}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-border/70 bg-[hsl(var(--panel-strong))] p-6 shadow-[var(--surface-shadow)] backdrop-blur-[18px]">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
  stackOnMobile = false,
  alignTop = false,
}: {
  label: string;
  description: string;
  children: ReactNode;
  stackOnMobile?: boolean;
  alignTop?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex gap-4 border-b border-border/55 py-4 last:border-b-0 last:pb-0',
        stackOnMobile
          ? alignTop
            ? 'flex-col sm:flex-row sm:items-start sm:justify-between'
            : 'flex-col sm:flex-row sm:items-center sm:justify-between'
          : 'items-center justify-between'
      )}
    >
      <div className={cn('max-w-xl', stackOnMobile && 'sm:max-w-[20rem]', alignTop && 'sm:pt-1')}>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className={cn('shrink-0', stackOnMobile && 'min-w-0 w-full sm:w-auto')}>{children}</div>
    </div>
  );
}

function VoiceStatusCard({
  readyLabel,
  notReadyLabel,
  executableLabel,
  modelLabel,
  executableFound,
  modelFound,
  available,
  notes,
  error,
  onDismissError,
}: {
  readyLabel: string;
  notReadyLabel: string;
  executableLabel: string;
  modelLabel: string;
  executableFound: boolean;
  modelFound: boolean;
  available: boolean;
  notes: string[];
  error?: string | null;
  onDismissError?: () => void;
}) {
  return (
    <div className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4 text-sm shadow-[var(--surface-shadow-soft)]">
      <p className="font-medium">{available ? readyLabel : notReadyLabel}</p>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p>{executableLabel}: {executableFound ? 'found' : 'missing'}</p>
        <p>{modelLabel}: {modelFound ? 'found' : 'missing'}</p>
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
      {error ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
          <span>{error}</span>
          {onDismissError ? (
            <Button variant="ghost" size="sm" onClick={onDismissError}>
              Dismiss
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 rounded-full border transition-all duration-150',
        checked
          ? 'border-primary/20 bg-primary/90 shadow-[0_8px_22px_hsl(var(--primary)/0.18)]'
          : 'border-border/80 bg-muted/85'
      )}
    >
      <span
        className={cn(
          'absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_2px_10px_rgba(15,23,42,0.14)] transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0'
        )}
      />
    </button>
  );
}

function FeedbackSummaryCard({
  summary,
  isLoading,
  historyEnabled,
  onRefresh,
}: {
  summary: MessageFeedbackSummary | null;
  isLoading: boolean;
  historyEnabled: boolean;
  onRefresh: () => void;
}) {
  const ratedCount = summary?.ratedCount ?? 0;
  const helpfulCount = summary?.helpfulCount ?? 0;
  const notUsefulCount = summary?.notUsefulCount ?? 0;
  const assistantMessageCount = summary?.assistantMessageCount ?? 0;
  const helpfulRate = ratedCount > 0 ? Math.round((helpfulCount / ratedCount) * 100) : null;

  return (
    <section className="rounded-[2rem] border border-border/70 bg-[hsl(var(--panel-strong))] p-6 shadow-[var(--surface-shadow)] backdrop-blur-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Response Feedback</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track whether assistant replies are matching what users actually wanted.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading || !historyEnabled}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {!historyEnabled ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
          Enable conversation history to save and summarize thumbs up/down feedback.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Helpful" value={helpfulCount.toLocaleString()} tone="up" />
            <MetricTile label="Not Useful" value={notUsefulCount.toLocaleString()} tone="down" />
            <MetricTile label="Rated Replies" value={ratedCount.toLocaleString()} />
            <MetricTile label="All Assistant Replies" value={assistantMessageCount.toLocaleString()} />
          </div>

          <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm">
            {helpfulRate === null ? (
              <p className="text-muted-foreground">
                No response feedback has been recorded yet. Once users start rating replies, this workspace will show how often the assistant is landing well.
              </p>
            ) : (
              <p>
                Current helpful rate: <span className="font-semibold">{helpfulRate}%</span> of rated assistant replies.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        tone === 'up'
          ? 'border-emerald-500/20 bg-emerald-500/10'
          : tone === 'down'
            ? 'border-rose-500/20 bg-rose-500/10'
            : 'border-border bg-background/70'
      )}
    >
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
