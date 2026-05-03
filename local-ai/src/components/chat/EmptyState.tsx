import { useAgentStore } from '@/stores/agentStore';

export function EmptyState() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const brainName = activeAgent?.name ?? 'This brain';

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-3xl rounded-[2rem] border border-border/70 bg-[hsl(var(--panel-strong))] px-8 py-12 text-center shadow-[var(--surface-shadow)] backdrop-blur-[18px]">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-[linear-gradient(145deg,hsl(var(--primary)/0.12),hsl(27_75%_82%/0.45))] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <span className="text-3xl">✦</span>
        </div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          First Exchange
        </p>
        <h2 className="mb-3 text-3xl font-semibold leading-tight">{brainName} is ready for a first conversation</h2>
        <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground">
          Send a message, drop in an image or audio note, or record with the mic to start chatting with {brainName}. If
          you expected an older conversation here, switch brains from the header and ModernClawMacMulti will reopen the
          latest chat for that brain.
        </p>
      </div>
    </div>
  );
}
