'use client';

import { Plus, MessageSquare, X, PanelLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DAWAPersonaId } from '@/lib/dawa-personas';

interface DawaTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  personaId?: DAWAPersonaId;
  sessionId?: string;
  citations?: Array<{ id?: string; title?: string; source: string; url?: string; excerpt?: string; confidence?: number }>;
  attachments?: Array<{ name: string; type: string; url?: string }>;
}

interface Conversation {
  id: string;
  title: string;
  turns: DawaTurn[];
  timestamp: string;
  personaId?: DAWAPersonaId;
}

interface DawaChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onStartNewChat: () => void;
  onLoadConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function DawaChatSidebar({
  conversations,
  currentConversationId,
  sidebarOpen,
  onToggleSidebar,
  onStartNewChat,
  onLoadConversation,
  onDeleteConversation,
}: DawaChatSidebarProps) {
  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.div
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          exit={{ x: -280 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-72 bg-[#0C1410] border-r border-white/10 flex flex-col"
        >
          <div className="p-4 border-b border-white/10">
            <button
              onClick={onStartNewChat}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-card bg-emerald/10 hover:bg-emerald/20 text-emerald border border-emerald/20 transition-all"
              type="button"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-semibold">New Chat</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onLoadConversation(conv.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg transition-all group",
                  currentConversationId === conv.id
                    ? "bg-emerald/10 border border-emerald/20"
                    : "hover:bg-content-bg/5 border border-transparent"
                )}
                type="button"
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    currentConversationId === conv.id ? "text-emerald" : "text-mist/40 group-hover:text-mist"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-mist truncate">{conv.title}</div>
                    <div className="text-[10px] text-mist/40 mt-0.5">
                      {new Date(conv.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all"
                    type="button"
                  >
                    <X className="w-3 h-3 text-mist/40 hover:text-red-400" />
                  </button>
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-white/10">
            <button
              onClick={onToggleSidebar}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg hover:bg-content-bg/5 text-mist/40 transition-all"
              type="button"
            >
              <PanelLeft className="w-4 h-4" />
              <span className="text-xs">Close Sidebar</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
