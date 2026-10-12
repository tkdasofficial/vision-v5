import { useState, type ReactNode } from "react";
import { ArrowLeft, Search, X, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router-compat";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PageMenuItem } from "@/components/page-header";

export default function FloatingWorkspacePage({ title, children, actions, query, onQueryChange, menu, footer, backTo = "/drawer" }: {
  title: string; children: ReactNode; actions?: ReactNode; query: string; onQueryChange: (value: string) => void; menu?: PageMenuItem[]; backTo?: string; footer?: ReactNode;
}) {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  return <div className="app-drawer relative grid h-[100dvh] grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden bg-settings-canvas text-foreground" data-scrolled={scrolled}>
    <header className="drawer-top pointer-events-none relative z-10 col-start-1 row-start-1 self-start px-4 pb-5 pt-[max(12px,env(safe-area-inset-top))] sm:px-8">
      <div className={`pointer-events-auto mx-auto grid h-11 max-w-4xl items-center gap-2 ${searching ? "grid-cols-[44px_minmax(0,1fr)]" : "grid-cols-[1fr_auto_1fr]"}`}>
        <Button variant="floating" size="icon" className="size-11 justify-self-start rounded-full" aria-label={searching ? `Back to ${title}` : backTo === "/drawer" ? "Back to drawer" : "Back"} title="Back" onClick={() => { if (searching) { setSearching(false); onQueryChange(""); } else navigate(backTo); }}><ArrowLeft className="size-5" /></Button>
        {searching ? <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus type="search" value={query} onChange={(e) => onQueryChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setSearching(false); onQueryChange(""); } }} aria-label={`Search ${title.toLowerCase()}`} placeholder={`Search ${title.toLowerCase()}`} className="drawer-floating h-11 w-full rounded-full pl-12 pr-12 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden" />
          {query && <Button variant="ghost" size="icon" className="absolute right-0 top-0 size-11 rounded-full" aria-label="Clear search" title="Clear search" onClick={() => onQueryChange("")}><X /></Button>}
        </div> : <>
          <h1 className="drawer-floating flex h-11 min-w-0 max-w-full items-center rounded-full px-3 font-display text-base font-semibold sm:px-6 sm:text-xl">{title}</h1>
          <div className="flex items-center justify-end gap-1 sm:gap-2">
            {actions}
            <Button variant="floating" size="icon" className="size-11 shrink-0 rounded-full" aria-label={`Search ${title.toLowerCase()}`} title={`Search ${title.toLowerCase()}`} onClick={() => setSearching(true)}><Search className="size-5" /></Button>
            {menu && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="floating" size="icon" className="size-11 shrink-0 rounded-full" aria-label="More options" title="More options"><MoreVertical /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{menu.map((item) => <DropdownMenuItem key={item.label} onSelect={item.onSelect}>{item.icon && <item.icon className="size-4" />}{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
          </div>
        </>}
      </div>
    </header>
    <div className={`col-start-1 row-start-1 min-h-0 overflow-y-auto px-4 ${footer ? "pb-32" : "pb-[max(24px,env(safe-area-inset-bottom))]"} pt-[max(80px,calc(env(safe-area-inset-top)+68px))] sm:px-8`} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}><div className="mx-auto max-w-4xl">{children}</div></div>
    {footer && <div className="drawer-bottom pointer-events-none relative z-10 col-start-1 row-start-1 self-end pb-[max(12px,env(safe-area-inset-bottom))]"><div className="pointer-events-auto">{footer}</div></div>}
  </div>;
}