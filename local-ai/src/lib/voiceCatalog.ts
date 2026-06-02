import { IS_MAC_MODEL_PROVIDER } from '@/lib/providerConfig';

export interface CuratedVoiceOption {
  id: string;
  label: string;
  filename: string;
  description: string;
}

export const CURATED_PIPER_VOICES: CuratedVoiceOption[] = [
  {
    id: 'amy-medium',
    label: 'Amy (Female)',
    filename: 'en_US-amy-medium.onnx',
    description: 'Softer female voice option for longer listening sessions.',
  },
  {
    id: 'joe-medium',
    label: 'Joe (Male)',
    filename: 'en_US-joe-medium.onnx',
    description: 'Clear male voice option with a slightly firmer tone.',
  },
] as const;

export const DEFAULT_PIPER_VOICE_ID = 'amy-medium';
export const DEFAULT_WHISPER_MODEL_FILENAME = 'ggml-base.en.bin';
export const DEFAULT_FLOOR_MODEL = IS_MAC_MODEL_PROVIDER ? 'google/gemma-4-e4b' : 'gemma4:e4b';
export const LIGHTWEIGHT_FLOOR_MODEL = IS_MAC_MODEL_PROVIDER ? 'google/gemma-4-e2b' : 'gemma4:e2b';
export const LEGACY_FLOOR_MODEL = 'nchapman/dolphin3.0-qwen2.5:3b';
export const LEGACY_FALLBACK_MODEL = 'dolphin3:8b';

export const CURATED_FLOOR_MODELS = IS_MAC_MODEL_PROVIDER
  ? ([
      {
        name: DEFAULT_FLOOR_MODEL,
        size: '',
        description:
          'Advanced help for images, local tools, and harder tasks.',
        recommended: true,
      },
      {
        name: LIGHTWEIGHT_FLOOR_MODEL,
        size: '',
        description:
          'Everyday chat for quick questions and learning.',
        recommended: false,
      },
    ] as const)
  : ([
      {
        name: DEFAULT_FLOOR_MODEL,
        size: '',
        description: 'Advanced help for images, local tools, and harder tasks.',
        recommended: true,
      },
      {
        name: LIGHTWEIGHT_FLOOR_MODEL,
        size: '',
        description: 'Everyday chat for quick questions and learning.',
        recommended: false,
      },
    ] as const);

export function getCuratedVoiceById(id: string) {
  return CURATED_PIPER_VOICES.find((voice) => voice.id === id) ?? CURATED_PIPER_VOICES[0];
}
