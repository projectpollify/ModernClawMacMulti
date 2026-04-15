import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BrainActivityEntry, BrainSuggestion, KnowledgeIntakeRecord, SuggestionStatus } from '@/types';

interface BrainScopedState {
  suggestions: BrainSuggestion[];
  draftAnswers: Record<string, string>;
  activityLog: BrainActivityEntry[];
  recentKnowledge: KnowledgeIntakeRecord[];
}

interface SuggestionState extends BrainScopedState {
  activeBrainId: string;
  brainStates: Record<string, BrainScopedState>;
  setActiveBrain: (brainId: string) => void;
  updateStatus: (id: string, status: SuggestionStatus) => void;
  setDraftAnswer: (id: string, value: string) => void;
  clearDraftAnswer: (id: string) => void;
  addActivity: (entry: Omit<BrainActivityEntry, 'id' | 'createdAt'>) => void;
  addKnowledgeRecord: (record: Omit<KnowledgeIntakeRecord, 'id' | 'createdAt'>) => void;
  resetSuggestions: () => void;
}

const makeInitialSuggestions = (): BrainSuggestion[] => [
  {
    id: 'profile-role',
    title: 'Clarify your primary role',
    summary: 'Add a stronger work identity to USER.md so the assistant can personalize its advice more accurately.',
    kind: 'profile',
    target: 'USER.md',
    reason: 'The current profile has personal context, but not a strong work or project identity.',
    status: 'pending',
    createdAt: '2026-03-30',
    questionPrompt: 'What kind of work do you do most often, and what do you want this AI to help you with?',
  },
  {
    id: 'memory-projects',
    title: 'Add active project tracking',
    summary: 'Create a dedicated section in MEMORY.md for active projects and current priorities.',
    kind: 'memory',
    target: 'MEMORY.md',
    reason: 'The memory file should become the durable index for ongoing work, not just static notes.',
    status: 'pending',
    createdAt: '2026-03-30',
    proposedContent: '## Active Projects\n- ModernClaw product differentiation\n- Mac version validation\n- Public release preparation',
  },
  {
    id: 'knowledge-source-intake',
    title: 'Start a knowledge intake workflow',
    summary: 'Add a lightweight path for attaching source material and turning it into structured knowledge files.',
    kind: 'knowledge',
    target: 'knowledge/',
    reason: 'A useful brain needs more than chat history. It should grow from curated source material.',
    status: 'pending',
    createdAt: '2026-03-30',
  },
  {
    id: 'behavior-structured-output',
    title: 'Refine assistant output structure',
    summary: 'Teach SOUL.md to prefer structured, decision-ready outputs when the user is building plans or products.',
    kind: 'behavior',
    target: 'SOUL.md',
    reason: 'The differentiated product should feel like an evolving strategic partner, not just a chat bot.',
    status: 'pending',
    createdAt: '2026-03-30',
  },
];

const makeEmptyBrainState = (): BrainScopedState => ({
  suggestions: makeInitialSuggestions(),
  draftAnswers: {},
  activityLog: [],
  recentKnowledge: [],
});

function makeInitialState(): Pick<
  SuggestionState,
  'activeBrainId' | 'brainStates' | 'suggestions' | 'draftAnswers' | 'activityLog' | 'recentKnowledge'
> {
  const defaultBrainState = makeEmptyBrainState();
  return {
    activeBrainId: 'default',
    brainStates: { default: cloneBrainState(defaultBrainState) },
    ...cloneBrainState(defaultBrainState),
  };
}

const cloneBrainState = (state: BrainScopedState): BrainScopedState => ({
  suggestions: state.suggestions.map((suggestion) => ({ ...suggestion })),
  draftAnswers: { ...state.draftAnswers },
  activityLog: state.activityLog.map((entry) => ({ ...entry })),
  recentKnowledge: state.recentKnowledge.map((record) => ({ ...record })),
});

const defaultState = makeInitialState();

function getBrainState(brainStates: Record<string, BrainScopedState>, brainId: string): BrainScopedState {
  return brainStates[brainId] ? cloneBrainState(brainStates[brainId]) : makeEmptyBrainState();
}

function syncBrainState(
  state: SuggestionState,
  updater: (current: BrainScopedState) => BrainScopedState
): Partial<SuggestionState> {
  const currentBrainState = updater({
    suggestions: state.suggestions,
    draftAnswers: state.draftAnswers,
    activityLog: state.activityLog,
    recentKnowledge: state.recentKnowledge,
  });

  return {
    ...currentBrainState,
    brainStates: {
      ...state.brainStates,
      [state.activeBrainId]: currentBrainState,
    },
  };
}

export const useSuggestionStore = create<SuggestionState>()(
  persist(
    (set) => ({
      ...defaultState,

      setActiveBrain: (brainId) =>
        set((state) => {
          const currentState: BrainScopedState = {
            suggestions: state.suggestions,
            draftAnswers: state.draftAnswers,
            activityLog: state.activityLog,
            recentKnowledge: state.recentKnowledge,
          };

          const nextBrainStates = {
            ...state.brainStates,
            [state.activeBrainId]: currentState,
          };

          const nextBrainState = getBrainState(nextBrainStates, brainId);

          return {
            activeBrainId: brainId,
            brainStates: nextBrainStates[brainId]
              ? nextBrainStates
              : { ...nextBrainStates, [brainId]: nextBrainState },
            ...nextBrainState,
          };
        }),

      updateStatus: (id, status) =>
        set((state) =>
          syncBrainState(state, (current) => ({
            ...current,
            suggestions: current.suggestions.map((suggestion) =>
              suggestion.id === id ? { ...suggestion, status } : suggestion
            ),
          }))
        ),

      setDraftAnswer: (id, value) =>
        set((state) =>
          syncBrainState(state, (current) => ({
            ...current,
            draftAnswers: {
              ...current.draftAnswers,
              [id]: value,
            },
          }))
        ),

      clearDraftAnswer: (id) =>
        set((state) =>
          syncBrainState(state, (current) => {
            const nextDraftAnswers = { ...current.draftAnswers };
            delete nextDraftAnswers[id];
            return {
              ...current,
              draftAnswers: nextDraftAnswers,
            };
          })
        ),

      addActivity: (entry) =>
        set((state) =>
          syncBrainState(state, (current) => ({
            ...current,
            activityLog: [
              {
                ...entry,
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: new Date().toISOString(),
              },
              ...current.activityLog,
            ].slice(0, 30),
          }))
        ),

      addKnowledgeRecord: (record) =>
        set((state) =>
          syncBrainState(state, (current) => ({
            ...current,
            recentKnowledge: [
              {
                ...record,
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: new Date().toISOString(),
              },
              ...current.recentKnowledge,
            ].slice(0, 12),
          }))
        ),

      resetSuggestions: () =>
        set((state) => {
          const resetState = makeEmptyBrainState();
          return {
            ...resetState,
            brainStates: {
              ...state.brainStates,
              [state.activeBrainId]: resetState,
            },
          };
        }),
    }),
    {
      name: 'modernclawmacmulti-brain-storage',
      partialize: (state) => ({
        activeBrainId: state.activeBrainId,
        brainStates: state.brainStates,
      }),
      merge: (persisted, current) => {
        const incoming = (persisted as Partial<SuggestionState>) ?? {};
        const activeBrainId = incoming.activeBrainId ?? current.activeBrainId;
        const brainStates = incoming.brainStates ?? current.brainStates;
        const nextBrainState = getBrainState(brainStates, activeBrainId);

        return {
          ...current,
          activeBrainId,
          brainStates,
          ...nextBrainState,
        };
      },
    }
  )
);
