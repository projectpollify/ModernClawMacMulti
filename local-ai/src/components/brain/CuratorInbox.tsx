import { Button } from '@/components/ui/Button';
import { useAgentStore } from '@/stores/agentStore';
import type { CuratorPackage } from '@/types';

interface CuratorInboxProps {
  packages: CuratorPackage[];
  activeId?: string | null;
  feedbackById?: Record<string, string>;
  onImport: (pkg: CuratorPackage) => void;
  onReject: (pkg: CuratorPackage) => void;
  onRefresh: () => void;
}

export function CuratorInbox({
  packages,
  activeId,
  feedbackById = {},
  onImport,
  onReject,
  onRefresh,
}: CuratorInboxProps) {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const brainName = activeAgent?.name ?? 'this brain';

  return (
    <section className="rounded-[30px] border border-border bg-background/75 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Curator Inbox
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">Staged Packages</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Review-ready packages prepared for {brainName}. Import the ones you trust into live knowledge,
            or reject them to keep this brain clean.
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Packages added outside the app appear here after refresh for the currently active brain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            Refresh
          </Button>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
            {packages.length} staged
          </span>
        </div>
      </div>

      {packages.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-border bg-background/60 p-5 text-center text-sm text-muted-foreground">
          No staged curator packages yet for {brainName}.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {packages.map((pkg) => {
            const busy = activeId === pkg.id;
            return (
              <div key={pkg.id} className="rounded-2xl border border-border bg-background/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">{pkg.title}</h3>
                    {pkg.requestTopic ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {pkg.requestTopic}
                      </p>
                    ) : null}
                  </div>
                  {pkg.createdAt ? (
                    <span className="text-xs text-muted-foreground">{formatTimestamp(pkg.createdAt)}</span>
                  ) : null}
                </div>

                {pkg.summary ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{pkg.summary}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {pkg.source ? (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                      {pkg.source}
                    </span>
                  ) : null}
                  {pkg.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>

                {feedbackById[pkg.id] ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {feedbackById[pkg.id]}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onImport(pkg)} disabled={busy}>
                    {busy ? 'Working...' : 'Import to Knowledge'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onReject(pkg)} disabled={busy}>
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
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
