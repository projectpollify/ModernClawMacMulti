import type { ReactNode } from 'react';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { APP_DISPLAY_NAME } from '@/lib/providerConfig';
import { useSidebarStore, useViewStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import brandIcon from '@/assets/brand/modernclaw-icon.png';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { ConversationList } from './ConversationList';
import { NewChatButton } from './NewChatButton';

export function Sidebar() {
  const isOpen = useSidebarStore((state) => state.isOpen);
  const open = useSidebarStore((state) => state.open);
  const activeView = useViewStore((state) => state.activeView);
  const setView = useViewStore((state) => state.setView);
  const { isCoreReady } = useSetupStatus();

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-border/60 bg-[hsl(var(--panel))] backdrop-blur-[22px]',
        'transition-[width] duration-200 ease-out',
        isOpen ? 'w-64' : 'w-16'
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-border',
          isOpen ? 'justify-start px-4' : 'justify-center px-2'
        )}
      >
        <button
          onClick={open}
          className={cn(
            'flex items-center gap-3 rounded-xl transition-colors',
            isOpen ? 'cursor-default' : 'px-1 py-1 hover:bg-accent'
          )}
          disabled={isOpen}
          aria-label={isOpen ? 'Sidebar open' : 'Expand sidebar'}
          title={isOpen ? undefined : 'Expand sidebar'}
        >
          {isOpen ? (
            <div className="flex items-center gap-2.5">
              <img src={brandIcon} alt={APP_DISPLAY_NAME} className="h-8 w-8 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="text-[1.05rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
                  ModernClaw
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Local Private Workspace</p>
              </div>
            </div>
          ) : (
            <img src={brandIcon} alt={APP_DISPLAY_NAME} className="h-8 w-8 object-contain" />
          )}
        </button>
      </div>

      {isOpen ? (
        <ScrollArea className="flex-1 p-2">
          <SidebarSection title="Conversations">
            <ConversationList />
          </SidebarSection>
        </ScrollArea>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-2 px-2 py-3">
          <CollapsedActionButton
            icon={<ExpandIcon className="h-4 w-4" />}
            label="Expand sidebar"
            onClick={open}
          />
          <div className="h-px w-8 bg-border" />
        </div>
      )}

      <div className={cn('border-t border-border/60 p-3', !isOpen && 'space-y-2')}>
        {isOpen ? <NewChatButton /> : <CollapsedNewChatButton />}
        <SidebarButton
          icon={<BrainIcon className="h-4 w-4" />}
          label="Memory"
          isActive={activeView === 'memory'}
          onClick={() => setView('memory')}
          isCollapsed={!isOpen}
        />
        <SidebarButton
          icon={<SparkIcon className="h-4 w-4" />}
          label="Brain"
          isActive={activeView === 'brain'}
          onClick={() => setView('brain')}
          isCollapsed={!isOpen}
        />
        <SidebarButton
          icon={<ShieldCheckIcon className="h-4 w-4" />}
          label="Setup"
          isActive={activeView === 'setup'}
          onClick={() => setView('setup')}
          isCollapsed={!isOpen}
          showAttention={!isCoreReady}
        />
        <SidebarButton
          icon={<SettingsIcon className="h-4 w-4" />}
          label="Settings"
          isActive={activeView === 'settings'}
          onClick={() => setView('settings')}
          isCollapsed={!isOpen}
        />
      </div>
    </aside>
  );
}

function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SidebarButton({
  icon,
  label,
  isActive,
  onClick,
  isCollapsed = false,
  showAttention = false,
}: {
  icon: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed?: boolean;
  showAttention?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={isCollapsed ? label : undefined}
      className={cn(
        'flex w-full items-center rounded-2xl text-sm transition-all duration-150',
        isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-3',
        isActive
          ? 'bg-[hsl(var(--panel-strong))] text-foreground shadow-[var(--surface-shadow-soft)]'
          : 'text-muted-foreground hover:bg-accent/45 hover:text-accent-foreground'
      )}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
      {isCollapsed ? null : (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span>{label}</span>
          {showAttention ? <AttentionDot /> : null}
        </span>
      )}
    </button>
  );
}

function AttentionDot() {
  return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />;
}

function CollapsedActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent/45 hover:text-accent-foreground"
    >
      {icon}
    </button>
  );
}

function CollapsedNewChatButton() {
  const open = useSidebarStore((state) => state.open);

  return (
    <CollapsedActionButton
      icon={<PlusIcon className="h-4 w-4" />}
      label="Expand sidebar to start a new chat"
      onClick={open}
    />
  );
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h12M4 18h16" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 3a3 3 0 00-3 3v1a3 3 0 00-2 2.83V10a3 3 0 001.11 2.33A3 3 0 004 14v.17A3 3 0 006 17v1a3 3 0 003 3h1v-7H8m7-11a3 3 0 013 3v1a3 3 0 012 2.83V10a3 3 0 01-1.11 2.33A3 3 0 0120 14v.17A3 3 0 0118 17v1a3 3 0 01-3 3h-1v-7h2"
      />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zm6 11l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14zm-12 0l.9 2.1L9 17l-2.1.9L6 20l-.9-2.1L3 17l2.1-.9L6 14z" />
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

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 12.5l1.5 1.5 3.5-4" />
    </svg>
  );
}
