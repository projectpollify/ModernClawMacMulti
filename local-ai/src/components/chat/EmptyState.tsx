import { useAgentStore } from '@/stores/agentStore';

export function EmptyState() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const brainName = activeAgent?.name ?? 'This brain';

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <span className="text-2xl">Chat</span>
      </div>
      <h2 className="mb-2 text-xl font-semibold">{brainName} is ready for a first conversation</h2>
      <p className="max-w-md text-muted-foreground">
        Send a message, drop in an image or audio note, or record with the mic to start chatting with {brainName}. If
        you expected an older conversation here, switch brains from the header and ModernClawMacMulti will reopen the
        latest chat for that brain.
      </p>
    </div>
  );
}
