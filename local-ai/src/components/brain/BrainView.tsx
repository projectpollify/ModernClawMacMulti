import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CuratorInbox } from '@/components/brain/CuratorInbox';
import { QuestionQueueCard } from '@/components/brain/QuestionQueueCard';
import { SuggestionCard } from '@/components/brain/SuggestionCard';
import { formatCharacterRange, formatSoftLimit, getContentGuidance, getLengthState } from '@/lib/contentGuidance';
import { useAgentStore } from '@/stores/agentStore';
import { useMemoryStore } from '@/stores/memoryStore';
import { useSuggestionStore } from '@/stores/suggestionStore';
import type { BrainActivityAction, BrainActivityEntry, BrainSuggestion, CuratorPackage, KnowledgeIntakeRecord } from '@/types';

export function BrainView() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const initializeMemory = useMemoryStore((state) => state.initialize);
  const suggestions = useSuggestionStore((state) => state.suggestions);
  const draftAnswers = useSuggestionStore((state) => state.draftAnswers);
  const activityLog = useSuggestionStore((state) => state.activityLog);
  const recentKnowledge = useSuggestionStore((state) => state.recentKnowledge);
  const updateStatus = useSuggestionStore((state) => state.updateStatus);
  const setDraftAnswer = useSuggestionStore((state) => state.setDraftAnswer);
  const clearDraftAnswer = useSuggestionStore((state) => state.clearDraftAnswer);
  const addActivity = useSuggestionStore((state) => state.addActivity);
  const addKnowledgeRecord = useSuggestionStore((state) => state.addKnowledgeRecord);
  const resetSuggestions = useSuggestionStore((state) => state.resetSuggestions);
  const curatorStagedPackages = useMemoryStore((state) => state.curatorStagedPackages);
  const importCuratorPackage = useMemoryStore((state) => state.importCuratorPackage);
  const rejectCuratorPackage = useMemoryStore((state) => state.rejectCuratorPackage);
  const soul = useMemoryStore((state) => state.soul);
  const user = useMemoryStore((state) => state.user);
  const memory = useMemoryStore((state) => state.memory);
  const loadFile = useMemoryStore((state) => state.loadFile);
  const saveFile = useMemoryStore((state) => state.saveFile);
  const refreshKnowledge = useMemoryStore((state) => state.refreshKnowledge);
  const knowledgeFiles = useMemoryStore((state) => state.knowledgeFiles);
  const refreshCurator = useMemoryStore((state) => state.refreshCurator);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeSummary, setKnowledgeSummary] = useState('');
  const [knowledgeTags, setKnowledgeTags] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [knowledgeSource, setKnowledgeSource] = useState('');
  const [isSavingKnowledge, setIsSavingKnowledge] = useState(false);
  const [knowledgeFeedback, setKnowledgeFeedback] = useState<string | null>(null);
  const [setupRole, setSetupRole] = useState('');
  const [setupSupport, setSetupSupport] = useState('');
  const [setupTone, setSetupTone] = useState('');
  const [setupPriorities, setSetupPriorities] = useState('');
  const [isApplyingSetup, setIsApplyingSetup] = useState(false);
  const [setupFeedback, setSetupFeedback] = useState<string | null>(null);
  const [curatorActionId, setCuratorActionId] = useState<string | null>(null);
  const [curatorFeedbackById, setCuratorFeedbackById] = useState<Record<string, string>>({});

  const pending = suggestions.filter((suggestion) => suggestion.status === 'pending');
  const deferred = suggestions.filter((suggestion) => suggestion.status === 'deferred');
  const accepted = suggestions.filter((suggestion) => suggestion.status === 'accepted');
  const dismissed = suggestions.filter((suggestion) => suggestion.status === 'dismissed');
  const queuedQuestions = pending.filter((suggestion) => Boolean(suggestion.questionPrompt));
  const pendingSuggestions = pending.filter((suggestion) => !suggestion.questionPrompt);

  const knowledgeGuidance = getContentGuidance('knowledge-file');
  const knowledgeLengthState = getLengthState(knowledgeContent.trim().length, knowledgeGuidance);
  const answerGuidance = getContentGuidance('profile-answer');
  const memoryGuidance = getContentGuidance('memory-file');

  useEffect(() => {
    void initializeMemory();
  }, [initializeMemory]);

  useEffect(() => {
    setApplyingId(null);
    setFeedbackById({});
    setError(null);
    setKnowledgeTitle('');
    setKnowledgeSummary('');
    setKnowledgeTags('');
    setKnowledgeContent('');
    setKnowledgeSource('');
    setIsSavingKnowledge(false);
    setKnowledgeFeedback(null);
    setSetupRole('');
    setSetupSupport('');
    setSetupTone('');
    setSetupPriorities('');
    setIsApplyingSetup(false);
    setSetupFeedback(null);
    setCuratorActionId(null);
    setCuratorFeedbackById({});
  }, [activeAgent?.agentId]);

  const setupStatusItems = [
    {
      label: 'SOUL.md',
      ready: hasSection(soul?.content, '## Collaboration Preferences'),
      note: 'response style and collaboration tone',
    },
    {
      label: 'USER.md',
      ready: hasSection(user?.content, '## Work Identity') && hasSection(user?.content, '## What I Need Help With'),
      note: 'role, context, and desired support',
    },
    {
      label: 'MEMORY.md',
      ready: hasSection(memory?.content, '## Active Priorities'),
      note: 'current priorities for the brain to track',
    },
  ];

  const recordSuggestionAction = (suggestion: BrainSuggestion, action: BrainActivityAction, detail: string) => {
    addActivity({
      suggestionId: suggestion.id,
      title: suggestion.title,
      action,
      detail,
    });
  };

  const transitionSuggestion = (suggestion: BrainSuggestion, status: BrainSuggestion['status'], action: BrainActivityAction, detail: string) => {
    updateStatus(suggestion.id, status);
    recordSuggestionAction(suggestion, action, detail);
  };

  const applySuggestion = async (suggestion: BrainSuggestion) => {
    setApplyingId(suggestion.id);
    setError(null);

    try {
      if (suggestion.id === 'profile-role') {
        const answer = draftAnswers[suggestion.id]?.trim();

        if (!answer) {
          throw new Error('Add an answer before applying this profile suggestion.');
        }

        const file = await loadFile('USER.md');
        const nextContent = upsertSection(file.content, '## Work Identity', answer);
        await saveFile('USER.md', nextContent);
        clearDraftAnswer(suggestion.id);
        transitionSuggestion(suggestion, 'accepted', 'accepted', 'Saved a structured answer into USER.md.');
        setFeedbackById((state) => ({
          ...state,
          [suggestion.id]: 'Saved to USER.md and marked as accepted.',
        }));
        return;
      }

      if (suggestion.id === 'memory-projects' && suggestion.proposedContent) {
        const file = await loadFile('MEMORY.md');
        const nextContent = mergeMarkdownBlock(file.content, suggestion.proposedContent);
        await saveFile('MEMORY.md', nextContent);
        transitionSuggestion(suggestion, 'accepted', 'accepted', 'Applied structured project tracking to MEMORY.md.');
        setFeedbackById((state) => ({
          ...state,
          [suggestion.id]: 'Applied to MEMORY.md and marked as accepted.',
        }));
        return;
      }

      transitionSuggestion(suggestion, 'accepted', 'accepted', 'Accepted in Brain workflow.');
      setFeedbackById((state) => ({
        ...state,
        [suggestion.id]: 'Accepted. File routing for this suggestion type is planned next.',
      }));
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : String(applyError);
      setError(message);
    } finally {
      setApplyingId(null);
    }
  };

  const applyGuidedSetup = async () => {
    const trimmedRole = setupRole.trim();
    const trimmedSupport = setupSupport.trim();
    const trimmedTone = setupTone.trim();
    const trimmedPriorities = setupPriorities.trim();

    if (!trimmedRole || !trimmedSupport || !trimmedTone || !trimmedPriorities) {
      setError('Fill in all guided setup fields so the starter brain has enough context to work with.');
      return;
    }

    setIsApplyingSetup(true);
    setError(null);
    setSetupFeedback(null);

    try {
      const [soulFile, userFile, memoryFile] = await Promise.all([
        loadFile('SOUL.md'),
        loadFile('USER.md'),
        loadFile('MEMORY.md'),
      ]);

      const nextSoul = upsertSection(
        soulFile.content,
        '## Collaboration Preferences',
        ['Preferred collaboration style:', trimmedTone].join('\n')
      );

      const nextUser = upsertSection(
        upsertSection(userFile.content, '## Work Identity', trimmedRole),
        '## What I Need Help With',
        trimmedSupport
      );

      const nextMemory = upsertSection(
        memoryFile.content,
        '## Active Priorities',
        toBulletList(trimmedPriorities)
      );

      await saveFile('SOUL.md', nextSoul);
      await saveFile('USER.md', nextUser);
      await saveFile('MEMORY.md', nextMemory);

      addActivity({
        title: 'Guided Brain Setup',
        action: 'setup_applied',
        detail: 'Updated SOUL.md, USER.md, and MEMORY.md with the guided starter setup.',
      });

      setSetupFeedback('Starter sections were written into SOUL.md, USER.md, and MEMORY.md.');
      setSetupRole('');
      setSetupSupport('');
      setSetupTone('');
      setSetupPriorities('');
    } catch (setupError) {
      const message = setupError instanceof Error ? setupError.message : String(setupError);
      setError(message);
    } finally {
      setIsApplyingSetup(false);
    }
  };

  const handleCuratorImport = async (pkg: CuratorPackage) => {
    setCuratorActionId(pkg.id);
    setError(null);

    try {
      const filename = await importCuratorPackage(pkg.folderName);
      addActivity({
        title: pkg.title,
        action: 'curator_imported',
        detail: `Imported staged curator package into knowledge/${filename}.`,
      });
      setCuratorFeedbackById((state) => ({
        ...state,
        [pkg.id]: `Imported into knowledge/${filename}.`,
      }));
    } catch (curatorError) {
      const message = curatorError instanceof Error ? curatorError.message : String(curatorError);
      setError(message);
    } finally {
      setCuratorActionId(null);
    }
  };

  const handleCuratorReject = async (pkg: CuratorPackage) => {
    setCuratorActionId(pkg.id);
    setError(null);

    try {
      await rejectCuratorPackage(pkg.folderName);
      addActivity({
        title: pkg.title,
        action: 'curator_rejected',
        detail: 'Rejected staged curator package before it reached live knowledge.',
      });
      setCuratorFeedbackById((state) => ({
        ...state,
        [pkg.id]: 'Rejected staged package.',
      }));
    } catch (curatorError) {
      const message = curatorError instanceof Error ? curatorError.message : String(curatorError);
      setError(message);
    } finally {
      setCuratorActionId(null);
    }
  };

  const saveKnowledgeFile = async () => {
    const trimmedTitle = knowledgeTitle.trim();
    const trimmedSummary = knowledgeSummary.trim();
    const trimmedContent = knowledgeContent.trim();
    const trimmedSource = knowledgeSource.trim();
    const parsedTags = knowledgeTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!trimmedTitle) {
      setError('Add a short knowledge title before saving.');
      return;
    }

    if (!trimmedContent) {
      setError('Paste source material or notes before saving a knowledge file.');
      return;
    }

    const filename = `knowledge/${slugify(trimmedTitle)}.md`;
    const body = [
      `# ${trimmedTitle}`,
      '',
      trimmedSummary ? '## Summary' : null,
      trimmedSummary || null,
      trimmedSummary ? '' : null,
      trimmedSource ? `Source: ${trimmedSource}` : null,
      trimmedSource ? '' : null,
      parsedTags.length > 0 ? `Tags: ${parsedTags.join(', ')}` : null,
      parsedTags.length > 0 ? '' : null,
      '## Content',
      trimmedContent,
      '',
      '> Added through the Brain knowledge intake workflow.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    setIsSavingKnowledge(true);
    setError(null);
    setKnowledgeFeedback(null);

    try {
      await saveFile(filename, body);
      await refreshKnowledge();
      addKnowledgeRecord({
        filename,
        title: trimmedTitle,
        source: trimmedSource || undefined,
        summary: trimmedSummary || undefined,
        tags: parsedTags,
      });
      addActivity({
        title: trimmedTitle,
        action: 'knowledge_saved',
        detail: `Created ${filename} through the knowledge intake workflow.`,
      });
      setKnowledgeFeedback(`Saved ${filename} and refreshed the knowledge list.`);
      setKnowledgeTitle('');
      setKnowledgeSummary('');
      setKnowledgeTags('');
      setKnowledgeContent('');
      setKnowledgeSource('');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(message);
    } finally {
      setIsSavingKnowledge(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-6">
        <section className="rounded-[32px] border border-border bg-background/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Brain Builder
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Suggestions Inbox</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                This is the first differentiated layer for ModernClaw. Instead of silently mutating memory,
                the app proposes profile, memory, knowledge, and behavior improvements for review.
              </p>
              {activeAgent ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-secondary-foreground">
                  <span className="font-semibold uppercase tracking-[0.16em]">Active Brain</span>
                  <span>{activeAgent.name}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="px-4" onClick={resetSuggestions}>
                Reset Seed Suggestions
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
            {error}
          </section>
        ) : null}

        <section className="rounded-[30px] border border-border bg-background/75 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Guided Setup
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">Fast-Start the Brain</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                This gives the app a stronger starting point by writing starter sections into SOUL.md,
                USER.md, and MEMORY.md. It is meant to be a guided first pass, not a perfect final profile.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {setupStatusItems.map((item) => (
                <span
                  key={item.label}
                  className={`rounded-full px-3 py-1 text-xs ${item.ready ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-secondary text-secondary-foreground'}`}
                >
                  {item.label}: {item.ready ? 'ready' : 'needs setup'}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <GuidedField
              label="Primary Role"
              value={setupRole}
              onChange={setSetupRole}
              placeholder="Founder, strategist, builder, preparedness planner, or the role you work from most often."
              guidance={answerGuidance}
            />
            <GuidedField
              label="What You Want Help With"
              value={setupSupport}
              onChange={setSetupSupport}
              placeholder="Describe what you want the AI to help you do more effectively."
              guidance={answerGuidance}
            />
            <GuidedField
              label="Preferred Collaboration Style"
              value={setupTone}
              onChange={setSetupTone}
              placeholder="Calm and direct, tactical and concise, strategic and structured, etc."
              guidance={answerGuidance}
            />
            <GuidedField
              label="Current Priorities"
              value={setupPriorities}
              onChange={setSetupPriorities}
              placeholder="List the projects, pressures, or priorities the brain should keep seeing. One per line works well."
              guidance={memoryGuidance}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {setupStatusItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">{item.label}</p>
                <p className="mt-1 leading-6">{item.note}</p>
              </div>
            ))}
          </div>

          {setupFeedback ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              {setupFeedback}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="sm" className="px-5" onClick={() => void applyGuidedSetup()} disabled={isApplyingSetup}>
              {isApplyingSetup ? 'Applying Guided Setup...' : 'Apply Guided Setup'}
            </Button>
            <p className="text-xs leading-6 text-muted-foreground">
              This safely updates starter sections and can be refined later from Memory or Brain.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Pending" value={pending.length} />
          <StatCard label="Deferred" value={deferred.length} />
          <StatCard label="Accepted" value={accepted.length} />
          <StatCard label="Dismissed" value={dismissed.length} />
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Question Queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Focused questions the Brain still wants answered so it can build a stronger long-term profile.
            </p>
          </div>

          {queuedQuestions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-background/60 p-6 text-center">
              <p className="text-sm text-muted-foreground">No queued questions right now.</p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {queuedQuestions.map((suggestion) => (
                <QuestionQueueCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  draftAnswer={draftAnswers[suggestion.id]}
                  feedback={feedbackById[suggestion.id] ?? null}
                  isApplying={applyingId === suggestion.id}
                  onDraftAnswerChange={(value) => setDraftAnswer(suggestion.id, value)}
                  onApply={() => void applySuggestion(suggestion)}
                  onDefer={() => transitionSuggestion(suggestion, 'deferred', 'deferred', 'Deferred from the question queue.')}
                  onDismiss={() => transitionSuggestion(suggestion, 'dismissed', 'dismissed', 'Dismissed from the question queue.')}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Pending Suggestions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reviewable proposals that can shape the user profile and brain over time.
            </p>
          </div>

          {pendingSuggestions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-background/60 p-6 text-center">
              <p className="text-sm text-muted-foreground">No pending suggestions right now.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {pendingSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  draftAnswer={draftAnswers[suggestion.id]}
                  acceptLabel={getAcceptLabel(suggestion)}
                  feedback={feedbackById[suggestion.id] ?? null}
                  isApplying={applyingId === suggestion.id}
                  onDraftAnswerChange={(value) => setDraftAnswer(suggestion.id, value)}
                  onAccept={() => void applySuggestion(suggestion)}
                  onDefer={() => transitionSuggestion(suggestion, 'deferred', 'deferred', 'Deferred from pending suggestions.')}
                  onDismiss={() => transitionSuggestion(suggestion, 'dismissed', 'dismissed', 'Dismissed from pending suggestions.')}
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <StatusSection
              title="Deferred Suggestions"
              description="Ideas or questions you paused for later. Bring them back when you are ready to keep shaping the brain."
              suggestions={deferred}
              emptyMessage="No deferred suggestions right now."
              primaryLabel="Return to Pending"
              onPrimaryAction={(suggestion) => transitionSuggestion(suggestion, 'pending', 'returned', 'Returned from deferred back to pending.')}
              secondaryLabel="Dismiss"
              onSecondaryAction={(suggestion) => transitionSuggestion(suggestion, 'dismissed', 'dismissed', 'Dismissed from deferred.')}
            />

            <StatusSection
              title="Accepted Suggestions"
              description="Approved changes that have already influenced the brain-building process."
              suggestions={accepted}
              emptyMessage="Accepted suggestions will appear here after you apply them."
              primaryLabel="Archive as Dismissed"
              onPrimaryAction={(suggestion) => transitionSuggestion(suggestion, 'dismissed', 'dismissed', 'Archived after being accepted.')}
            />
          </div>

          <div className="space-y-6">
            <CuratorInbox
              packages={curatorStagedPackages}
              activeId={curatorActionId}
              feedbackById={curatorFeedbackById}
              onImport={(pkg) => void handleCuratorImport(pkg)}
              onRefresh={() => void refreshCurator()}
              onReject={(pkg) => void handleCuratorReject(pkg)}
            />

            <section className="rounded-[30px] border border-border bg-background/75 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Deeper Knowledge Flow
                  </p>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight">Knowledge Intake</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Paste source material, add summary and tags, then save it into the local knowledge folder as
                    a structured Markdown file.
                  </p>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    Recommended length: {formatCharacterRange(knowledgeGuidance)}. Soft limit: {formatSoftLimit(knowledgeGuidance)}.
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                  {knowledgeFiles.length} files
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Title
                  </label>
                  <input
                    value={knowledgeTitle}
                    onChange={(event) => setKnowledgeTitle(event.target.value)}
                    placeholder="Urban bug-out checklist"
                    className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Summary
                  </label>
                  <textarea
                    value={knowledgeSummary}
                    onChange={(event) => setKnowledgeSummary(event.target.value)}
                    placeholder="Add a short plain-language summary so the Brain can understand what this file is about at a glance."
                    className="mt-2 min-h-[96px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Tags
                  </label>
                  <input
                    value={knowledgeTags}
                    onChange={(event) => setKnowledgeTags(event.target.value)}
                    placeholder="preparedness, operations, comms"
                    className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Source or Notes
                  </label>
                  <input
                    value={knowledgeSource}
                    onChange={(event) => setKnowledgeSource(event.target.value)}
                    placeholder="Book, PDF, article, field notes, or your own summary"
                    className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Knowledge Content
                  </label>
                  <textarea
                    value={knowledgeContent}
                    onChange={(event) => setKnowledgeContent(event.target.value)}
                    placeholder="Paste source material, curated notes, or your structured summary here..."
                    className="mt-2 min-h-[220px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{knowledgeContent.trim().length} characters</span>
                    <span>{guidanceStatusLabel(knowledgeLengthState)}</span>
                  </div>
                </div>

                {knowledgeFeedback ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {knowledgeFeedback}
                  </div>
                ) : null}

                <Button size="sm" className="self-start px-5" onClick={() => void saveKnowledgeFile()} disabled={isSavingKnowledge}>
                  {isSavingKnowledge ? 'Saving Knowledge...' : 'Save Knowledge File'}
                </Button>
              </div>
            </section>

            <HistorySection title="Recent Brain Activity" entries={activityLog} />
            <RecentKnowledgeSection records={recentKnowledge} />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[28px] border border-border bg-background/75 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function GuidedField({
  label,
  value,
  onChange,
  placeholder,
  guidance,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  guidance: ReturnType<typeof getContentGuidance>;
}) {
  const trimmedLength = value.trim().length;
  const lengthState = getLengthState(trimmedLength, guidance);

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        Recommended length: {formatCharacterRange(guidance)}. Soft limit: {formatSoftLimit(guidance)}.
      </p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-[132px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{trimmedLength} characters</span>
        <span>{guidanceStatusLabel(lengthState)}</span>
      </div>
    </div>
  );
}

function StatusSection({
  title,
  description,
  suggestions,
  emptyMessage,
  primaryLabel,
  onPrimaryAction,
  secondaryLabel,
  onSecondaryAction,
}: {
  title: string;
  description: string;
  suggestions: BrainSuggestion[];
  emptyMessage: string;
  primaryLabel: string;
  onPrimaryAction: (suggestion: BrainSuggestion) => void;
  secondaryLabel?: string;
  onSecondaryAction?: (suggestion: BrainSuggestion) => void;
}) {
  return (
    <section className="rounded-[30px] border border-border bg-background/75 p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>

      {suggestions.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-border bg-background/60 p-5 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {suggestion.kind}
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight">{suggestion.title}</h3>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                  {suggestion.target}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{suggestion.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onPrimaryAction(suggestion)}>
                  {primaryLabel}
                </Button>
                {secondaryLabel && onSecondaryAction ? (
                  <Button size="sm" variant="ghost" onClick={() => onSecondaryAction(suggestion)}>
                    {secondaryLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HistorySection({ title, entries }: { title: string; entries: BrainActivityEntry[] }) {
  return (
    <section className="rounded-[30px] border border-border bg-background/75 p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Lightweight approval history so Brain changes feel reviewable instead of temporary.
      </p>

      {entries.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-border bg-background/60 p-5 text-center text-sm text-muted-foreground">
          No Brain activity yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {formatActivityAction(entry.action)}
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight">{entry.title}</h3>
                </div>
                <span className="text-xs text-muted-foreground">{formatTimestamp(entry.createdAt)}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{entry.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentKnowledgeSection({ records }: { records: KnowledgeIntakeRecord[] }) {
  return (
    <section className="rounded-[30px] border border-border bg-background/75 p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Recent Knowledge Additions</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        The most recent files created through the Brain knowledge intake workflow.
      </p>

      {records.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-border bg-background/60 p-5 text-center text-sm text-muted-foreground">
          No knowledge files created through Brain yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {records.map((record) => (
            <div key={record.id} className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">{record.title}</h3>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{record.filename}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatTimestamp(record.createdAt)}</span>
              </div>
              {record.summary ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{record.summary}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {record.source ? (
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                    {record.source}
                  </span>
                ) : null}
                {record.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getAcceptLabel(suggestion: BrainSuggestion) {
  if (suggestion.id === 'memory-projects') {
    return 'Apply to MEMORY.md';
  }

  return 'Accept';
}

function mergeMarkdownBlock(content: string, block: string) {
  const [headingLine, ...bodyLines] = block.split('\n');
  const heading = headingLine.trim();
  const body = bodyLines.join('\n').trim();

  if (!heading.startsWith('## ')) {
    return appendBeforeDivider(content, block.trim());
  }

  return upsertSection(content, heading, body);
}

function upsertSection(content: string, heading: string, body: string) {
  const normalizedContent = content.trimEnd();
  const escapedHeading = escapeRegExp(heading);
  const sectionPattern = new RegExp(`${escapedHeading}\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`);
  const nextSection = `${heading}\n${body.trim()}\n`;

  if (sectionPattern.test(normalizedContent)) {
    return `${normalizedContent.replace(sectionPattern, nextSection)}\n`;
  }

  return appendBeforeDivider(normalizedContent, nextSection.trim());
}

function appendBeforeDivider(content: string, block: string) {
  const divider = '\n---';
  const dividerIndex = content.indexOf(divider);

  if (dividerIndex >= 0) {
    return `${content.slice(0, dividerIndex).trimEnd()}\n\n${block.trim()}\n\n${content.slice(dividerIndex).trimStart()}\n`;
  }

  return `${content.trimEnd()}\n\n${block.trim()}\n`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'knowledge-note';
}

function hasSection(content: string | undefined, heading: string) {
  return Boolean(content && content.includes(heading));
}

function toBulletList(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  return lines
    .map((line) => (line.startsWith('- ') ? line : `- ${line}`))
    .join('\n');
}

function guidanceStatusLabel(state: ReturnType<typeof getLengthState>) {
  switch (state) {
    case 'good':
      return 'In recommended range';
    case 'short':
      return 'Still short';
    case 'long':
      return 'Getting long';
    case 'over':
      return 'Over soft limit';
  }
}

function formatActivityAction(action: BrainActivityAction) {
  switch (action) {
    case 'accepted':
      return 'Accepted';
    case 'deferred':
      return 'Deferred';
    case 'dismissed':
      return 'Dismissed';
    case 'returned':
      return 'Returned to pending';
    case 'knowledge_saved':
      return 'Knowledge saved';
    case 'setup_applied':
      return 'Guided setup applied';
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

