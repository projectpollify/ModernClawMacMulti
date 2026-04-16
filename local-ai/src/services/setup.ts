import { invoke } from '@tauri-apps/api/core';
import { IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_APP_PATH, MODEL_PROVIDER_DOWNLOAD_URL } from '@/lib/providerConfig';

const ENGINE_DOWNLOAD_URL = 'https://github.com/ggml-org/llama.cpp';

export const setupApi = {
  async openExternal(target: string): Promise<void> {
    return invoke('setup_open_external', { target });
  },

  async openEngineDownload(): Promise<void> {
    return invoke('setup_open_external', {
      target: IS_MAC_MODEL_PROVIDER ? MODEL_PROVIDER_DOWNLOAD_URL : ENGINE_DOWNLOAD_URL,
    });
  },

  async openProviderApp(): Promise<void> {
    const target = IS_MAC_MODEL_PROVIDER ? MODEL_PROVIDER_APP_PATH || MODEL_PROVIDER_DOWNLOAD_URL : ENGINE_DOWNLOAD_URL;
    return invoke('setup_open_external', {
      target,
    });
  },

  async startEngine(): Promise<void> {
    return invoke('setup_start_engine');
  },

  async switchDirectEngineModel(modelName: string): Promise<string> {
    return invoke('setup_switch_direct_engine_model', { modelName });
  },
};

export { ENGINE_DOWNLOAD_URL };
