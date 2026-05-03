import { Button } from '@/components/ui/Button';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { APP_DISPLAY_NAME } from '@/lib/providerConfig';
import { useViewStore } from '@/stores/uiStore';

export function SetupAttentionBanner() {
  const setView = useViewStore((state) => state.setView);
  const { isCoreReady, requiredItems, summary } = useSetupStatus();

  if (isCoreReady) {
    return null;
  }

  const attentionItems = requiredItems.filter((item) => item.state === 'attention');

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-100">
            Setup Attention
          </p>
          <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-200">
            Setup still needs attention before {APP_DISPLAY_NAME} is fully ready.
          </p>
          <p className="mt-1 text-sm text-amber-700/90 dark:text-amber-100/90">
            Required setup: {summary.requiredReady}/{summary.requiredTotal} ready.
            {attentionItems.length > 0 ? ` Still missing: ${attentionItems.map((item) => item.label).join(', ')}.` : null}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView('setup')} className="border-amber-500/30 bg-transparent">
            Open Setup
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView('settings')} className="border-amber-500/30 bg-transparent">
            Open Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
