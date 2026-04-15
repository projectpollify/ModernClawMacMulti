import { Button } from '@/components/ui/Button';
import { SetupStatusPanel } from '@/components/setup/SetupStatusPanel';
import { APP_DISPLAY_NAME, IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_NAME } from '@/lib/providerConfig';
import { useViewStore } from '@/stores/uiStore';

export function SetupView() {
  const setView = useViewStore((state) => state.setView);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-[32px] border border-border bg-background/80 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Installation Readiness</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{APP_DISPLAY_NAME} Setup</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Use this page as the single source of truth for getting {APP_DISPLAY_NAME} ready on a new machine. It
            shows what is required before normal chat use, what is optional, and where to go next when something is
            missing.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setView('chat')}>
              Back to Chat
            </Button>
            <Button variant="outline" onClick={() => setView('settings')}>
              Open Settings
            </Button>
            <Button variant="outline" onClick={() => setView('memory')}>
              Open Memory
            </Button>
          </div>
        </section>

        <SetupStatusPanel description="Required setup should be green before regular use. Voice input and output are optional and can be added later without blocking chat." />

        <section className="grid gap-6 lg:grid-cols-3">
          <InfoCard
            title="What must be ready"
            body={
              IS_MAC_MODEL_PROVIDER
                ? `${MODEL_PROVIDER_NAME} needs to be serving on port 8080, at least one Gemma 4 GGUF model needs to be available, and the workspace files need to exist.`
                : 'Ollama needs to be running, at least one local model needs to be installed, and the workspace files need to exist.'
            }
          />
          <InfoCard
            title="What can wait"
            body="Voice output and microphone transcription are optional. They matter for convenience, not for core chat setup."
          />
          <InfoCard
            title="When packaging"
            body="This is the page to check on a clean machine. If anything here feels confusing, that is a packaging issue worth fixing."
          />
        </section>
      </div>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[28px] border border-border bg-background/75 p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </section>
  );
}
