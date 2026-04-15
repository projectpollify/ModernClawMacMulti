import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IS_MAC_MODEL_PROVIDER, MODEL_PROVIDER_NAME, MODEL_PROVIDER_STATUS_URL } from '@/lib/providerConfig';
import { useSetupActions } from '@/hooks/useSetupActions';
import { useModelStore } from '@/stores/modelStore';

interface OllamaStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function OllamaStep({ onNext, onBack }: OllamaStepProps) {
  const ollamaStatus = useModelStore((state) => state.ollamaStatus);
  const checkStatus = useModelStore((state) => state.checkStatus);
  const {
    openProviderApp,
    startOllama,
    isOpeningDownload,
    isStartingOllama,
    actionError,
    actionNotice,
    clearActionError,
    clearActionNotice,
  } = useSetupActions();
  const [isChecking, setIsChecking] = useState(true);

  const runCheck = async () => {
    setIsChecking(true);
    try {
      await checkStatus();
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  const isRunning = ollamaStatus?.running ?? false;

  return (
    <StepShell
      eyebrow="Step 1"
      title={IS_MAC_MODEL_PROVIDER ? 'Check Direct Engine' : 'Check Ollama'}
      description={
        IS_MAC_MODEL_PROVIDER
          ? 'ModernClawMac talks to a local llama.cpp engine on your machine to run the model layer.'
          : 'ModernClaw talks to Ollama on your machine to run the model layer.'
      }
      backLabel="Back"
      nextLabel={isRunning ? 'Continue to Model' : 'Continue'}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!isRunning}
    >
      {isChecking ? (
        <StatusCard
          tone="neutral"
          title={IS_MAC_MODEL_PROVIDER ? 'Checking for Direct Engine...' : 'Checking for Ollama...'}
          description={`Looking for a running ${MODEL_PROVIDER_NAME} instance at ${MODEL_PROVIDER_STATUS_URL}.`}
        />
      ) : isRunning ? (
        <StatusCard
          tone="success"
          title={`${MODEL_PROVIDER_NAME} is running`}
          description={
            ollamaStatus?.version
              ? `Version detected: ${ollamaStatus.version}. The next step is ${
                  IS_MAC_MODEL_PROVIDER ? 'confirming a Gemma 4 model in the direct engine.' : 'installing the recommended model.'
                }`
              : IS_MAC_MODEL_PROVIDER
                ? 'You are ready to confirm the recommended model in the direct engine next.'
                : 'You are ready to install the recommended model next.'
          }
        />
      ) : (
        <StatusCard
          tone="warning"
          title={IS_MAC_MODEL_PROVIDER ? 'Direct Engine not detected' : 'Ollama not detected'}
          description={
            IS_MAC_MODEL_PROVIDER
              ? 'Start the local llama.cpp engine on port 8080 with a Gemma 4 model, then check again.'
              : 'Install and start Ollama, then check again. ModernClaw depends on it for model execution.'
          }
        >
          <div className="mt-5 rounded-2xl bg-background/60 p-4 text-left text-sm leading-7 text-muted-foreground">
            <ol className="list-decimal space-y-1 pl-5">
              {IS_MAC_MODEL_PROVIDER ? (
                <>
                  <li>Make sure `llama-server` is installed on this machine.</li>
                  <li>Start the local engine on port 8080.</li>
                  <li>Load a Gemma 4 GGUF model there, then come back and click Check Again.</li>
                </>
              ) : (
                <>
                  <li>
                    Install Ollama from{' '}
                    <a
                      href="https://ollama.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      ollama.com
                    </a>
                    .
                  </li>
                  <li>Start Ollama on this machine.</li>
                  <li>Come back and click Check Again.</li>
                </>
              )}
            </ol>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => void openProviderApp()} disabled={isOpeningDownload}>
                {isOpeningDownload ? 'Opening...' : IS_MAC_MODEL_PROVIDER ? 'Open Engine Guide' : 'Download Ollama'}
              </Button>
              {!IS_MAC_MODEL_PROVIDER ? (
                <Button variant="outline" onClick={() => void startOllama()} disabled={isStartingOllama}>
                  {isStartingOllama ? 'Starting Ollama...' : 'Start Ollama'}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void runCheck()}>
                Check Again
              </Button>
            </div>
          </div>
        </StatusCard>
      )}

      {actionError ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <span>{actionError}</span>
          <Button variant="ghost" size="sm" onClick={clearActionError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {actionNotice ? (
        <div
          className={`mt-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
            actionNotice.tone === 'success'
              ? 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300'
              : 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
          }`}
        >
          <span>{actionNotice.message}</span>
          <Button variant="ghost" size="sm" onClick={clearActionNotice}>
            Dismiss
          </Button>
        </div>
      ) : null}
    </StepShell>
  );
}

function StepShell({
  eyebrow,
  title,
  description,
  children,
  onBack,
  onNext,
  nextDisabled = false,
  nextLabel,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: string;
  backLabel: string;
}) {
  return (
    <div>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>
      </div>

      <div className="mt-8">{children}</div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          {backLabel}
        </Button>
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

function StatusCard({
  tone,
  title,
  description,
  children,
}: {
  tone: 'neutral' | 'success' | 'warning';
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
      : tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-border bg-secondary/35 text-foreground';

  return (
    <div className={`rounded-[28px] border p-8 text-center ${toneClasses}`}>
      <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-current/20" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
