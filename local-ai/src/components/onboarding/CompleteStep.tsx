import { Button } from '@/components/ui/Button';
import { SetupStatusPanel } from '@/components/setup/SetupStatusPanel';
import { APP_DISPLAY_NAME, IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_NAME } from '@/lib/providerConfig';
import { useViewStore } from '@/stores/uiStore';

export function CompleteStep({ onFinish }: { onFinish: () => void }) {
  const setView = useViewStore((state) => state.setView);

  const handleFinish = () => {
    setView('chat');
    onFinish();
  };

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-green-500/12 text-green-700 dark:text-green-300">
        <span className="text-3xl font-semibold">OK</span>
      </div>

      <h2 className="text-3xl font-semibold tracking-tight">You&apos;re Ready</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
        {IS_MAC_MODEL_PROVIDER
          ? `${APP_DISPLAY_NAME} is set up and ready to chat through ${MODEL_PROVIDER_NAME}. You can refine personality in Memory, switch loaded models in Settings, and keep everything local.`
          : 'ModernClaw is set up and ready to chat. You can refine personality in Memory, switch models in Settings, and keep everything local.'}
      </p>

      <div className="mx-auto mt-8 max-w-4xl text-left">
        <SetupStatusPanel
          compact
          description="This is your single setup checklist. Required items should be ready before normal use, while voice features can stay optional."
        />
      </div>

      <div className="mx-auto mt-8 max-w-xl rounded-[28px] border border-border bg-secondary/35 p-6 text-left">
        <p className="text-sm font-medium">Good next steps</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>Edit SOUL.md to shape the assistant.</li>
          <li>Add household details to USER.md.</li>
          <li>Use Memory to keep durable notes and plans.</li>
          <li>{IS_MAC_MODEL_PROVIDER ? 'Use Settings to switch between your local direct-engine model lanes.' : 'Use Settings to manage models and prompt budget.'}</li>
        </ul>
      </div>

      <div className="mt-10">
        <Button onClick={handleFinish} className="rounded-xl px-6">
          Start Chatting
        </Button>
      </div>
    </div>
  );
}
