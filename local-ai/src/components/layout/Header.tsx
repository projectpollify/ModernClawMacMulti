import { useSidebarStore, useViewStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { BrainSelector } from '@/components/layout/BrainSelector';
import { ModelSelector } from '@/components/models/ModelSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAgentStore } from '@/stores/agentStore';

const titles = {
  chat: 'Chat',
  memory: 'Memory',
  brain: 'Brain',
  setup: 'Setup',
  settings: 'Settings',
} as const;

export function Header() {
  const toggle = useSidebarStore((state) => state.toggle);
  const activeView = useViewStore((state) => state.activeView);
  const setView = useViewStore((state) => state.setView);
  const activeAgent = useAgentStore((state) => state.activeAgent);

  return (
    <header className="relative z-40 flex h-[4.75rem] items-center justify-between overflow-visible border-b border-border/60 bg-[hsl(var(--panel))] px-5 backdrop-blur-[18px]">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Toggle sidebar"
          className="rounded-2xl border border-transparent bg-background/35 text-foreground/80 hover:border-border/60 hover:bg-background/70"
        >
          <MenuIcon className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Workspace View
          </p>
          <h1 className="mt-1 text-lg font-semibold">{titles[activeView]}</h1>
          <p className="text-xs text-muted-foreground/90">
            {activeAgent ? `${activeAgent.name} workspace` : 'Local-first workspace shell'}
          </p>
        </div>
      </div>

      <div className="relative z-50 flex flex-1 items-center justify-center gap-3 px-5">
        <BrainSelector />
        <ModelSelector />
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => setView('settings')}>
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
