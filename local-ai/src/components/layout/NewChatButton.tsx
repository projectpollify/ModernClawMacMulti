import { DEFAULT_FLOOR_MODEL } from '@/lib/voiceCatalog';
import { useConversationStore } from '@/stores/conversationStore';
import { useChatStore } from '@/stores/chatStore';
import { useViewStore } from '@/stores/uiStore';

export function NewChatButton() {
  const createConversation = useConversationStore((state) => state.createConversation);
  const currentModel = useChatStore((state) => state.currentModel);
  const newConversation = useChatStore((state) => state.newConversation);
  const setView = useViewStore((state) => state.setView);

  const handleNewChat = async () => {
    const conversationId = await createConversation(currentModel || DEFAULT_FLOOR_MODEL);
    newConversation(conversationId);
    setView('chat');
  };

  return (
    <button
      onClick={handleNewChat}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-[hsl(var(--panel-strong))] px-3.5 py-3 text-sm font-medium text-foreground shadow-[var(--surface-shadow-soft)] transition-all duration-150 hover:border-primary/20 hover:bg-accent/35 hover:text-accent-foreground"
    >
      <PlusIcon className="h-4 w-4" />
      <span>New Chat</span>
    </button>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
    </svg>
  );
}
