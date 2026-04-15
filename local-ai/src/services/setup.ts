import { invoke } from '@tauri-apps/api/core';
import { IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_APP_PATH, MODEL_PROVIDER_DOWNLOAD_URL } from '@/lib/providerConfig';

const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

export const setupApi = {
  async openExternal(target: string): Promise<void> {
    return invoke('setup_open_external', { target });
  },

  async openOllamaDownload(): Promise<void> {
    return invoke('setup_open_external', {
      target: IS_MAC_MODEL_PROVIDER ? MODEL_PROVIDER_DOWNLOAD_URL : OLLAMA_DOWNLOAD_URL,
    });
  },

  async openProviderApp(): Promise<void> {
    const target = IS_MAC_MODEL_PROVIDER ? MODEL_PROVIDER_APP_PATH || MODEL_PROVIDER_DOWNLOAD_URL : OLLAMA_DOWNLOAD_URL;
    return invoke('setup_open_external', {
      target,
    });
  },

  async startOllama(): Promise<void> {
    return invoke('setup_start_ollama');
  },

  async switchDirectEngineModel(modelName: string): Promise<string> {
    return invoke('setup_switch_direct_engine_model', { modelName });
  },
};

export { OLLAMA_DOWNLOAD_URL };
