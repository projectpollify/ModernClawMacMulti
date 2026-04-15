import { useEffect, useState } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useViewStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types';

export function ConversationList() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const conversations = useConversationStore((state) => state.conversations);
  const currentId = useConversationStore((state) => state.currentId);
  const selectConversation = useConversationStore((state) => state.selectConversation);
  const deleteConversation = useConversationStore((state) => state.deleteConversation);
  const renameConversation = useConversationStore((state) => state.renameConversation);
  const setView = useViewStore((state) => state.setView);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const recentConversations = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  useEffect(() => {
    setEditingId(null);
    setDraftTitle('');
  }, [activeAgent?.agentId]);

  if (recentConversations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-background/70 px-3 py-4 text-sm text-muted-foreground">
        <p>No conversations yet for {activeAgent?.name ?? 'this brain'}.</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Start a new chat to give this brain its own conversation history.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(recentConversations);

  const handleSelect = async (id: string) => {
    await selectConversation(id);
    setView('chat');
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    if (editingId === id) {
      setEditingId(null);
      setDraftTitle('');
    }
  };

  const beginRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftTitle('');
  };

  const saveRename = async (conversation: Conversation) => {
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      setDraftTitle(conversation.title);
      return;
    }

    if (trimmedTitle !== conversation.title) {
      await renameConversation(conversation.id, trimmedTitle);
    }

    cancelRename();
  };

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([label, items]) => (
        <div key={label}>
          <h3 className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </h3>
          <div className="space-y-1">
            {items.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentId}
                isEditing={conversation.id === editingId}
                draftTitle={draftTitle}
                onDraftTitleChange={setDraftTitle}
                onSelect={() => handleSelect(conversation.id)}
                onStartRename={() => beginRename(conversation)}
                onSaveRename={() => void saveRename(conversation)}
                onCancelRename={cancelRename}
                onDelete={() => void handleDelete(conversation.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isEditing: boolean;
  draftTitle: string;
  onDraftTitleChange: (value: string) => void;
  onSelect: () => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  isEditing,
  draftTitle,
  onDraftTitleChange,
  onSelect,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
}: ConversationItemProps) {
  return (
    <div
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {isEditing ? (
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={draftTitle}
            onChange={(event) => onDraftTitleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSaveRename();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancelRename();
              }
            }}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary/40"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSaveRename}
              className="rounded px-2 py-1 text-xs text-foreground transition-colors hover:bg-background/80"
            >
              Save
            </button>
            <button
              onClick={onCancelRename}
              className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{conversation.title}</p>
          {conversation.preview ? (
            <p className="truncate text-xs text-muted-foreground">{conversation.preview}</p>
          ) : null}
        </button>
      )}

      {!isEditing ? (
        <>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onStartRename();
            }}
            className="rounded p-1 opacity-0 transition-opacity hover:bg-background/80 group-hover:opacity-100"
            aria-label={`Rename ${conversation.title}`}
            title="Rename conversation"
          >
            <PencilIcon className="h-4 w-4" />
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 opacity-0 transition-opacity hover:bg-background/80 group-hover:opacity-100"
            aria-label={`Delete ${conversation.title}`}
            title="Delete conversation"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function groupByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  for (const conversation of conversations) {
    const updatedAt = new Date(conversation.updatedAt);

    if (updatedAt >= today) {
      groups.Today.push(conversation);
    } else if (updatedAt >= yesterday) {
      groups.Yesterday.push(conversation);
    } else if (updatedAt >= weekAgo) {
      groups['This Week'].push(conversation);
    } else {
      groups.Older.push(conversation);
    }
  }

  return Object.fromEntries(
    Object.entries(groups).filter(([, items]) => items.length > 0)
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
