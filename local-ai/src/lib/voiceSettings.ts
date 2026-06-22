import { getCuratedVoiceById } from '@/lib/voiceCatalog';
import { getDefaultVoicePaths } from '@/lib/voicePaths';
import type { Agent } from '@/types';
import type { AppSettings } from '@/types/settings';

export interface EffectiveVoiceSettings {
  enableVoiceOutput: boolean;
  piperVoicePreset: string;
  piperExecutablePath: string;
  piperModelPath: string;
  enableVoiceInput: boolean;
  whisperExecutablePath: string;
  whisperModelPath: string;
  whisperLanguage: string;
}

function isLegacyAgentLocalToolPath(path: string | null | undefined, activeAgent: Agent | null | undefined) {
  if (!path || !activeAgent?.workspacePath) {
    return false;
  }

  const normalizedPath = path.replace(/[\\/]+/g, '\\').toLowerCase();
  const normalizedWorkspace = activeAgent.workspacePath.replace(/[\\/]+/g, '\\').toLowerCase();
  return normalizedPath.startsWith(`${normalizedWorkspace}\\tools\\`);
}

function normalizeForComparison(path: string) {
  return path.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
}

function isGeneratedSharedToolPath(path: string | null | undefined, memoryPath: string | null | undefined) {
  if (!path || !memoryPath) {
    return false;
  }

  const normalizedPath = normalizeForComparison(path);
  const normalizedSharedBase = normalizeForComparison(memoryPath).replace(/\/agents\/[^/]+$/i, '');
  return normalizedPath.startsWith(`${normalizedSharedBase}/tools/`);
}

export function getEffectiveVoiceSettings(
  settings: AppSettings,
  activeAgent: Agent | null | undefined
): EffectiveVoiceSettings {
  const effectivePiperVoicePreset = getCuratedVoiceById(
    activeAgent?.piperVoicePreset ?? settings.piperVoicePreset
  ).id;
  const defaults = getDefaultVoicePaths(settings.memoryPath || '', effectivePiperVoicePreset);

  const effectivePiperModelPath =
    activeAgent?.piperModelPath &&
    !isLegacyAgentLocalToolPath(activeAgent.piperModelPath, activeAgent) &&
    !isGeneratedSharedToolPath(activeAgent.piperModelPath, settings.memoryPath)
      ? activeAgent.piperModelPath
      : defaults.piperModelPath;

  const effectiveWhisperModelPath =
    activeAgent?.whisperModelPath &&
    !isLegacyAgentLocalToolPath(activeAgent.whisperModelPath, activeAgent) &&
    !isGeneratedSharedToolPath(activeAgent.whisperModelPath, settings.memoryPath)
      ? activeAgent.whisperModelPath
      : isGeneratedSharedToolPath(settings.whisperModelPath, settings.memoryPath)
        ? defaults.whisperModelPath
        : settings.whisperModelPath || defaults.whisperModelPath;

  return {
    enableVoiceOutput: activeAgent?.enableVoiceOutput ?? settings.enableVoiceOutput,
    piperVoicePreset: effectivePiperVoicePreset,
    piperExecutablePath: isGeneratedSharedToolPath(settings.piperExecutablePath, settings.memoryPath)
      ? defaults.piperExecutablePath
      : settings.piperExecutablePath || defaults.piperExecutablePath,
    piperModelPath: effectivePiperModelPath,
    enableVoiceInput: activeAgent?.enableVoiceInput ?? settings.enableVoiceInput,
    whisperExecutablePath: isGeneratedSharedToolPath(settings.whisperExecutablePath, settings.memoryPath)
      ? defaults.whisperExecutablePath
      : settings.whisperExecutablePath || defaults.whisperExecutablePath,
    whisperModelPath: effectiveWhisperModelPath,
    whisperLanguage: activeAgent?.whisperLanguage ?? settings.whisperLanguage,
  };
}
