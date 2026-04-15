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
        size: 'Primary lane',
        description:
          'Primary Gemma 4 setup for ModernClawMac. Use this lane when you want the strongest local quality.',
        recommended: true,
      },
      {
        name: LIGHTWEIGHT_FLOOR_MODEL,
        size: 'Lighter lane',
        description:
          'Smaller Gemma 4 lane for ModernClawMac when you want a lower-resource option with the same supported family.',
        recommended: false,
      },
    ] as const)
  : ([
      {
        name: DEFAULT_FLOOR_MODEL,
        size: '9.6GB',
        description: 'Primary Gemma 4 setup for ModernClaw. Use this lane for the strongest supported local workspace experience.',
        recommended: true,
      },
      {
        name: LIGHTWEIGHT_FLOOR_MODEL,
        size: '7.2GB',
        description: 'Smaller Gemma 4 lane for lighter local setups when you want lower resource use with the same supported family.',
        recommended: false,
      },
    ] as const);

export function getCuratedVoiceById(id: string) {
  return CURATED_PIPER_VOICES.find((voice) => voice.id === id) ?? CURATED_PIPER_VOICES[0];
}
