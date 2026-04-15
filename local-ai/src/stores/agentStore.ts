import { create } from 'zustand';
import { agentApi } from '@/services/agents';
import type { Agent, AgentVoiceSettings } from '@/types';

interface AgentState {
  agents: Agent[];
  activeAgent: Agent | null;
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  loadAgents: () => Promise<void>;
  setActiveAgent: (agentId: string) => Promise<void>;
  createAgent: (agent: { agentId: string; name: string; description?: string; defaultModel?: string }) => Promise<void>;
  updateActiveAgentDefaultModel: (defaultModel: string | null) => Promise<void>;
  updateActiveAgentVoiceSettings: (voiceSettings: AgentVoiceSettings) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
  agents: [],
  activeAgent: null,
  isLoading: false,
  hasLoaded: false,
  error: null,

  loadAgents: async () => {
    set({ isLoading: true, error: null });

    try {
      const [agents, activeAgent] = await Promise.all([
        agentApi.listAgents(),
        agentApi.getActiveAgent(),
      ]);

      set({
        agents,
        activeAgent,
        isLoading: false,
        hasLoaded: true,
      });
    } catch (error) {
      set({
        isLoading: false,
        hasLoaded: true,
        error: String(error),
      });
    }
  },

  setActiveAgent: async (agentId) => {
    set({ isLoading: true, error: null });

    try {
      await agentApi.setActiveAgent(agentId);
      const [agents, activeAgent] = await Promise.all([
        agentApi.listAgents(),
        agentApi.getActiveAgent(),
      ]);

      set({
        agents,
        activeAgent,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: String(error),
      });
      throw error;
    }
  },

  createAgent: async (agent) => {
    set({ isLoading: true, error: null });

    try {
      await agentApi.createAgent(agent);
      const [agents, activeAgent] = await Promise.all([
        agentApi.listAgents(),
        agentApi.getActiveAgent(),
      ]);

      set({
        agents,
        activeAgent,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: String(error),
      });
      throw error;
    }
  },

  updateActiveAgentDefaultModel: async (defaultModel) => {
    const activeAgent = get().activeAgent;
    if (!activeAgent) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await agentApi.updateDefaultModel(activeAgent.agentId, defaultModel);
      const [agents, refreshedActiveAgent] = await Promise.all([
        agentApi.listAgents(),
        agentApi.getActiveAgent(),
      ]);

      set({
        agents,
        activeAgent: refreshedActiveAgent,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: String(error),
      });
      throw error;
    }
  },

  updateActiveAgentVoiceSettings: async (voiceSettings) => {
    const activeAgent = get().activeAgent;
    if (!activeAgent) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await agentApi.updateVoiceSettings(activeAgent.agentId, voiceSettings);
      const [agents, refreshedActiveAgent] = await Promise.all([
        agentApi.listAgents(),
        agentApi.getActiveAgent(),
      ]);

      set({
        agents,
        activeAgent: refreshedActiveAgent,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: String(error),
      });
      throw error;
    }
  },

  deleteAgent: async (agentId) => {
    set({ isLoading: true, error: null });

    try {
      await agentApi.deleteAgent(agentId);
      const [agents, activeAgent] = await Promise.all([
        agentApi.listAgents(),
        agentApi.getActiveAgent(),
      ]);

      set({
        agents,
        activeAgent,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: String(error),
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
