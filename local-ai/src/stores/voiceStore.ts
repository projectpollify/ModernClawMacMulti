import { getEffectiveVoiceSettings } from '@/lib/voiceSettings';
import { prepareTextForSpeech } from '@/lib/speechText';
import { create } from 'zustand';
import { voiceApi } from '@/services/voice';
import { useAgentStore } from '@/stores/agentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { VoiceInputStatus, VoiceOutputStatus } from '@/types/voice';

interface VoicePlayback {
  context: AudioContext;
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  startedAt: number;
  offset: number;
  token: number;
}

let activePlayback: VoicePlayback | null = null;
let playbackToken = 0;

function releaseAudio() {
  if (activePlayback) {
    try {
      activePlayback.source?.stop();
    } catch {
      // The source may already have ended; cleanup should still continue.
    }
    activePlayback.source = null;
    void activePlayback.context.close();
    activePlayback = null;
  }
}

function createAudioContext() {
  return new AudioContext();
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function startPlaybackSource(
  playback: VoicePlayback,
  onEnded: () => void,
  offset = playback.offset
) {
  const source = playback.context.createBufferSource();
  source.buffer = playback.buffer;
  source.connect(playback.context.destination);
  source.onended = onEnded;
  playback.source = source;
  playback.startedAt = playback.context.currentTime - offset;
  playback.offset = offset;
  source.start(0, offset);
}

interface VoiceState {
  outputStatus: VoiceOutputStatus | null;
  inputStatus: VoiceInputStatus | null;
  isCheckingOutput: boolean;
  isCheckingInput: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isTranscribing: boolean;
  speakingMessageId: string | null;
  error: string | null;
  checkOutputStatus: () => Promise<void>;
  checkInputStatus: () => Promise<void>;
  speakMessage: (messageId: string, text: string) => Promise<void>;
  pauseSpeaking: () => void;
  resumeSpeaking: () => Promise<void>;
  stopSpeaking: () => void;
  transcribeAudio: (audioData: Uint8Array) => Promise<string | null>;
  setError: (message: string | null) => void;
  clearError: () => void;
}

export const useVoiceStore = create<VoiceState>()((set, get) => ({
  outputStatus: null,
  inputStatus: null,
  isCheckingOutput: false,
  isCheckingInput: false,
  isSpeaking: false,
  isPaused: false,
  isTranscribing: false,
  speakingMessageId: null,
  error: null,

  checkOutputStatus: async () => {
    const settings = useSettingsStore.getState().settings;
    const activeAgent = useAgentStore.getState().activeAgent;
    const effectiveVoiceSettings = getEffectiveVoiceSettings(settings, activeAgent);

    set({ isCheckingOutput: true, error: null });

    try {
      const outputStatus = await voiceApi.checkOutputStatus({
        piperExecutablePath: effectiveVoiceSettings.piperExecutablePath,
        piperModelPath: effectiveVoiceSettings.piperModelPath,
      });

      set({ outputStatus, isCheckingOutput: false });
    } catch (error) {
      set({
        outputStatus: null,
        isCheckingOutput: false,
        error: String(error),
      });
    }
  },

  checkInputStatus: async () => {
    const settings = useSettingsStore.getState().settings;
    const activeAgent = useAgentStore.getState().activeAgent;
    const effectiveVoiceSettings = getEffectiveVoiceSettings(settings, activeAgent);

    set({ isCheckingInput: true, error: null });

    try {
      const inputStatus = await voiceApi.checkInputStatus({
        whisperExecutablePath: effectiveVoiceSettings.whisperExecutablePath,
        whisperModelPath: effectiveVoiceSettings.whisperModelPath,
      });

      set({ inputStatus, isCheckingInput: false });
    } catch (error) {
      set({
        inputStatus: null,
        isCheckingInput: false,
        error: String(error),
      });
    }
  },

  speakMessage: async (messageId, text) => {
    const state = get();
    const settings = useSettingsStore.getState().settings;
    const activeAgent = useAgentStore.getState().activeAgent;
    const effectiveVoiceSettings = getEffectiveVoiceSettings(settings, activeAgent);

    if (state.speakingMessageId === messageId) {
      if (state.isSpeaking && !state.isPaused) {
        state.pauseSpeaking();
        return;
      }

      if (state.isSpeaking && state.isPaused) {
        await state.resumeSpeaking();
        return;
      }
    }

    if (!effectiveVoiceSettings.enableVoiceOutput) {
      set({ error: 'Voice output is disabled in Settings.' });
      return;
    }

    const normalizedText = prepareTextForSpeech(text);

    playbackToken += 1;
    const currentToken = playbackToken;
    releaseAudio();

    set({
      isSpeaking: true,
      isPaused: false,
      speakingMessageId: messageId,
      error: null,
    });

    try {
      const audioBytes = await voiceApi.speak(normalizedText, {
        piperExecutablePath: effectiveVoiceSettings.piperExecutablePath,
        piperModelPath: effectiveVoiceSettings.piperModelPath,
      });

      if (currentToken !== playbackToken) {
        return;
      }

      const audioContext = createAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(toArrayBuffer(audioBytes));
      const playback: VoicePlayback = {
        context: audioContext,
        buffer: audioBuffer,
        source: null,
        startedAt: 0,
        offset: 0,
        token: currentToken,
      };

      activePlayback = playback;

      startPlaybackSource(playback, () => {
        if (currentToken !== playbackToken) {
          return;
        }
        releaseAudio();
        set({
          isSpeaking: false,
          isPaused: false,
          speakingMessageId: null,
        });
      });
    } catch (error) {
      if (currentToken === playbackToken) {
        releaseAudio();
        set({
          isSpeaking: false,
          isPaused: false,
          speakingMessageId: null,
          error: String(error),
        });
      }
    }
  },

  pauseSpeaking: () => {
    if (!activePlayback?.source) {
      return;
    }

    activePlayback.offset = Math.min(
      activePlayback.buffer.duration,
      activePlayback.context.currentTime - activePlayback.startedAt
    );
    activePlayback.source.onended = null;
    activePlayback.source.stop();
    activePlayback.source = null;
    set({
      isSpeaking: true,
      isPaused: true,
    });
  },

  resumeSpeaking: async () => {
    if (!activePlayback || activePlayback.offset >= activePlayback.buffer.duration) {
      return;
    }

    try {
      const playback = activePlayback;
      await playback.context.resume();
      startPlaybackSource(playback, () => {
        if (playback.token !== playbackToken) {
          return;
        }
        releaseAudio();
        set({
          isSpeaking: false,
          isPaused: false,
          speakingMessageId: null,
        });
      });
      set({
        isSpeaking: true,
        isPaused: false,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  stopSpeaking: () => {
    playbackToken += 1;
    releaseAudio();
    set({
      isSpeaking: false,
      isPaused: false,
      speakingMessageId: null,
    });
  },

  transcribeAudio: async (audioData) => {
    const settings = useSettingsStore.getState().settings;
    const activeAgent = useAgentStore.getState().activeAgent;
    const effectiveVoiceSettings = getEffectiveVoiceSettings(settings, activeAgent);

    if (!effectiveVoiceSettings.enableVoiceInput) {
      set({ error: 'Voice input is disabled in Settings.' });
      return null;
    }

    set({
      isTranscribing: true,
      error: null,
    });

    try {
      const transcript = await voiceApi.transcribe(audioData, {
        whisperExecutablePath: effectiveVoiceSettings.whisperExecutablePath,
        whisperModelPath: effectiveVoiceSettings.whisperModelPath,
        whisperLanguage: effectiveVoiceSettings.whisperLanguage,
      });

      set({ isTranscribing: false });
      return transcript;
    } catch (error) {
      set({
        isTranscribing: false,
        error: String(error),
      });
      return null;
    }
  },

  setError: (message) => set({ error: message }),
  clearError: () => set({ error: null }),
}));
