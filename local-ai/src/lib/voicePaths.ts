import { DEFAULT_PIPER_VOICE_ID, DEFAULT_WHISPER_MODEL_FILENAME, getCuratedVoiceById } from '@/lib/voiceCatalog';

export interface VoicePathDefaults {
  voiceRoot: string;
  piperFolder: string;
  piperVoicesFolder: string;
  whisperFolder: string;
  whisperModelsFolder: string;
  piperExecutablePath: string;
  piperModelPath: string;
  whisperExecutablePath: string;
  whisperModelPath: string;
}

function normalizeBasePath(memoryPath: string) {
  return memoryPath.replace(/[\\/]+$/, '');
}

function getPathSeparator(basePath: string) {
  return basePath.includes('\\') && !basePath.startsWith('/') ? '\\' : '/';
}

function joinPath(separator: string, ...parts: string[]) {
  return parts
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) {
        return part.replace(/[\\/]+$/, '');
      }
      return part.replace(/^[\\/]+|[\\/]+$/g, '');
    })
    .join(separator);
}

export function resolveSharedVoiceBasePath(memoryPath: string) {
  const normalizedBase = normalizeBasePath(memoryPath);
  const match = normalizedBase.match(/^(.*)[\\/]agents[\\/][^\\/]+$/i);
  return match?.[1] ?? normalizedBase;
}

export function getDefaultVoicePaths(memoryPath: string, voicePresetId: string = DEFAULT_PIPER_VOICE_ID): VoicePathDefaults {
  const sharedBase = resolveSharedVoiceBasePath(memoryPath);
  const separator = getPathSeparator(sharedBase);
  const executableExtension = separator === '\\' ? '.exe' : '';
  const voiceRoot = joinPath(separator, sharedBase, 'tools');
  const piperFolder = joinPath(separator, voiceRoot, 'piper');
  const piperVoicesFolder = joinPath(separator, piperFolder, 'voices');
  const whisperFolder = joinPath(separator, voiceRoot, 'whisper');
  const whisperModelsFolder = joinPath(separator, whisperFolder, 'models');
  const curatedVoice = getCuratedVoiceById(voicePresetId);

  return {
    voiceRoot,
    piperFolder,
    piperVoicesFolder,
    whisperFolder,
    whisperModelsFolder,
    piperExecutablePath: joinPath(separator, piperFolder, `piper${executableExtension}`),
    piperModelPath: joinPath(separator, piperVoicesFolder, curatedVoice.filename),
    whisperExecutablePath: joinPath(separator, whisperFolder, `whisper-cli${executableExtension}`),
    whisperModelPath: joinPath(separator, whisperModelsFolder, DEFAULT_WHISPER_MODEL_FILENAME),
  };
}
