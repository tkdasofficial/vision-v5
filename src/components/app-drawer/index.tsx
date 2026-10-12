import { useState } from "react";
import { Check, MessageSquare, Pencil, Pin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatHistory } from "@/context/ChatHistoryContext";
import { recentChats } from "@/lib/recent-chats";
import SidebarFeatures from "@/components/sidebar-features";
import ProfileMenu from "@/components/profile-menu";
import ChatItemMenu from "@/components/chat-item-menu";
import WorkspaceSearch from "@/components/workspace-search";
import { cn } from "@/lib/utils";

type Props = {
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  activeChatId?: string;
};

/** Shared full-screen navigation surface, also used by the preserved /search URL. */
export default function AppDrawerView({ onClose, onNewChat, onSelectChat, activeChatId, initialSearch = false }: Props & { initialSearch?: boolean }) {
  const { history, renameChat } = useChatHistory();
  const [searching, setSearching] = useState(initialSearch);
  const [scrolled, setScrolled] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const chats = recentChats(history);
  const selectChat = (id: string) => onSelectChat(id);
  const confirmRename = () => {
    if (editingId && editValue.trim()) renameChat(editingId, editValue.trim());
    setEditingId(null);
  };

  return <div className="app-drawer relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground" data-scrolled={scrolled}>
    {!searching && <header className="drawer-top absolute inset-x-0 top-0 z-10 px-4 pb-6 pt-[max(12px,env(safe-area-inset-top))] sm:px-8">
      <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="floating" className="h-11 min-w-0 px-5 font-display text-xl font-semibold" onClick={onNewChat}>Vision</Button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="floating" size="icon" className="size-11" aria-label="Search workspace" title="Search" onClick={() => { setScrolled(false); setSearching(true); }}><Search /></Button>
          <Button variant="floating" size="icon" className="size-11" aria-label="Close app drawer" title="Close drawer" onClick={onClose}><X /></Button>
        </div>
      </div>
    </header>}

    {searching ? <WorkspaceSearch topSearch onBack={() => { setScrolled(false); setSearching(false); }} onScrollChange={setScrolled} /> : <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-[max(84px,calc(env(safe-area-inset-top)+72px))] sm:px-8" onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}>
      <div className="mx-auto max-w-4xl">
        <SidebarFeatures />
        <section aria-label="Recent chats" className="mt-9">
          <h2 className="mb-3 px-3 text-sm font-medium text-muted-foreground">Recent</h2>
          {chats.length === 0 ? <p className="px-3 py-8 text-sm text-muted-foreground">No conversations yet</p> : <nav className="space-y-1">
            {chats.map((chat) => <div key={chat.id} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
              {editingId === chat.id ? <div className="col-span-2 flex min-w-0 items-center gap-2 px-3 py-2">
                <input autoFocus aria-label="Chat title" value={editValue} onChange={(event) => setEditValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") confirmRename(); if (event.key === "Escape") setEditingId(null); }} className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-secondary px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <Button variant="ghost" size="icon" aria-label="Save chat title" onClick={confirmRename}><Check /></Button>
                <Button variant="ghost" size="icon" aria-label="Cancel rename" onClick={() => setEditingId(null)}><X /></Button>
              </div> : <>
                <Button variant="ghost" onClick={() => selectChat(chat.id)} aria-current={activeChatId === chat.id ? "page" : undefined} className={cn("h-12 min-w-0 justify-start gap-3 rounded-lg px-3 font-normal", activeChatId === chat.id && "bg-accent text-accent-foreground")}>
                  <MessageSquare className="shrink-0 text-muted-foreground" /><span className="truncate">{chat.title}</span>{chat.pinned && <Pin className="ml-auto shrink-0 text-muted-foreground" />}
                </Button>
                <ChatItemMenu chatId={chat.id} title={chat.title} onRename={() => { setEditingId(chat.id); setEditValue(chat.title); }} />
              </>}
            </div>)}
          </nav>}
        </section>
      </div>
    </div>}

    {!searching && <footer className="drawer-bottom pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-10 sm:px-8">
      <div className="pointer-events-auto mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <Button variant="floating" className="h-12 w-fit px-5" onClick={onNewChat}><Pencil />New chat</Button>
        <ProfileMenu floating />
      </div>
    </footer>}
  </div>;
}

export { AppDrawerView };
