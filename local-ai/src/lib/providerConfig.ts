export const IS_MAC_MODEL_PROVIDER =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

export const APP_DISPLAY_NAME = IS_MAC_MODEL_PROVIDER ? 'ModernClawMac' : 'ModernClaw';
export const MODEL_PROVIDER_NAME = 'Direct Engine';
export const MODEL_PROVIDER_STATUS_URL = IS_MAC_MODEL_PROVIDER
  ? 'http://127.0.0.1:8080/v1/models'
  : 'http://localhost:11434/api/tags';
export const MODEL_PROVIDER_APP_PATH = '';
export const MODEL_PROVIDER_DOWNLOAD_URL = 'https://github.com/ggml-org/llama.cpp';

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'google/gemma-4-e2b': 'Conversational',
  'google/gemma-4-e4b': 'Thinking',
  'gemma4:e2b': 'Conversational',
  'gemma4:e4b': 'Thinking',
};

const MODEL_CAPABILITY_SUMMARIES: Record<string, string> = {
  'google/gemma-4-e2b': 'Everyday chat',
  'google/gemma-4-e4b': 'Advanced help',
  'gemma4:e2b': 'Everyday chat',
  'gemma4:e4b': 'Advanced help',
};

const MODEL_CAPABILITY_DETAILS: Record<string, string> = {
  'google/gemma-4-e2b': 'Quick responses for normal questions and learning.',
  'google/gemma-4-e4b': 'Use this for images, local tools, and harder tasks.',
  'gemma4:e2b': 'Quick responses for normal questions and learning.',
  'gemma4:e4b': 'Use this for images, local tools, and harder tasks.',
};

export function isRecommendedModelName(name: string | null | undefined) {
  const normalized = name?.trim().toLowerCase();
  return Boolean(normalized && (normalized.includes('gemma4') || normalized.includes('gemma-4')));
}

export function getModelDisplayName(name: string | null | undefined) {
  if (!name) {
    return '';
  }

  return MODEL_DISPLAY_NAMES[name] ?? name;
}

export function getModelCapabilitySummary(name: string | null | undefined) {
  if (!name) {
    return '';
  }

  return MODEL_CAPABILITY_SUMMARIES[name] ?? 'Local assistant';
}

export function getModelCapabilityDetail(name: string | null | undefined) {
  if (!name) {
    return '';
  }

  return MODEL_CAPABILITY_DETAILS[name] ?? 'Runs privately on this computer.';
}

export function resolvePreferredModelName(
  preferred: string | null | undefined,
  modelNames: string[]
) {
  const normalizedNames = modelNames.filter(Boolean);
  if (normalizedNames.length === 0) {
    return preferred ?? null;
  }

  if (preferred && normalizedNames.includes(preferred)) {
    return preferred;
  }

  const preferredLower = preferred?.toLowerCase() ?? '';
  if (preferredLower) {
    const fuzzyMatch = normalizedNames.find((name) => name.toLowerCase().includes(preferredLower));
    if (fuzzyMatch) {
      return fuzzyMatch;
    }
  }

  const gemmaMatch = normalizedNames.find((name) => isRecommendedModelName(name));
  if (gemmaMatch) {
    return gemmaMatch;
  }

  return normalizedNames[0] ?? null;
}
