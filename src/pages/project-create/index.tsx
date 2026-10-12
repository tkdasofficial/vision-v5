import { useState } from "react";
import { Brain, Check, FolderLock, FolderOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useLocation } from "@/lib/router-compat";
import { useChatHistory } from "@/context/ChatHistoryContext";
import { supabase } from "@/lib/cloud/client";
import { projectCategories, projectIcons } from "@/lib/project-options";
import { PROJECT_NAME_MAX, clampProjectName } from "@/lib/project-name";
import WorkspaceShell from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ProjectMemory = "default" | "project";
const memoryOptions: { value: ProjectMemory; title: string; body: string; icon: typeof Brain }[] = [
  { value: "default", title: "Default", body: "Uses your saved memories and can learn from chats here.", icon: Brain },
  { value: "project", title: "Project only", body: "Keeps memory inside this project. Other chats can’t see it.", icon: FolderLock },
];

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return <section className="motion-reveal rounded-3xl border border-border bg-card/60 p-4 sm:p-5" style={{ animationDelay: `${step * 50}ms` }}>
    <header className="mb-3 flex items-baseline gap-2">
      <span className="text-xs font-medium tabular-nums text-muted-foreground">0{step}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </header>
    {children}
  </section>;
}

export default function ProjectCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { setChatProject } = useChatHistory();
  const rawChat = (location.search as Record<string, unknown>).chat;
  const chatId = typeof rawChat === "string" && rawChat ? rawChat : null;
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [memory, setMemory] = useState<ProjectMemory>("default");
  const [saving, setSaving] = useState(false);
  const back = chatId ? `/chat/${chatId}` : "/projects";
  const PreviewIcon = projectIcons.find((entry) => entry.value === icon)?.icon ?? FolderOpen;
  const ready = !!name.trim() && !!category;

  const create = async () => {
    if (!user || !ready || saving) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const result = await supabase.from("workspace_projects").insert({ id, name: clampProjectName(name), icon, category, memory, user_id: user.id });
      if (result.error) { toast.error(result.error.message); return; }
      if (chatId && await setChatProject(chatId, id)) { toast.success(`Moved to ${name.trim()}`); navigate(`/chat/${chatId}`); return; }
      navigate("/projects");
    } catch { toast.error("Project couldn’t be created. Please try again."); }
    finally { setSaving(false); }
  };

  return <WorkspaceShell title="Create project" backTo={back}>
    <form className="mx-auto max-w-lg space-y-4 pb-28" onSubmit={(event) => { event.preventDefault(); void create(); }}>
      <div className="motion-reveal flex items-center gap-4 rounded-3xl border border-border bg-card p-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-secondary text-foreground transition-transform duration-300" key={icon ?? "none"}><PreviewIcon className="size-7 motion-reveal" /></div>
        <div className="min-w-0">
          <p className={cn("truncate text-base font-semibold", !name.trim() && "text-muted-foreground")}>{name.trim() || "Untitled project"}</p>
          <p className="truncate text-xs text-muted-foreground">{category || "No category"} · {memory === "project" ? "Project-only memory" : "Default memory"}</p>
        </div>
      </div>

      <Section step={1} title="Name">
        <div className="relative">
          <Input id="project-name" aria-label="Project name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Brand launch" maxLength={PROJECT_NAME_MAX} required disabled={saving} className="h-12 rounded-full pr-14 text-base" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">{name.length}/{PROJECT_NAME_MAX}</span>
        </div>
      </Section>

      <Section step={2} title="Icon" hint="Optional">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {projectIcons.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={icon === value} onClick={() => setIcon(icon === value ? null : value)} className={cn("motion-control grid aspect-square place-items-center rounded-full border transition-colors", icon === value ? "border-foreground bg-secondary" : "border-border hover:bg-accent")}><Icon className="size-5" /></button>)}
        </div>
      </Section>

      <Section step={3} title="Category">
        <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
          {projectCategories.map((entry) => <button key={entry} type="button" role="radio" aria-checked={category === entry} disabled={saving} onClick={() => setCategory(entry)} className={cn("motion-control h-9 rounded-full border px-4 text-sm transition-colors", category === entry ? "border-foreground bg-foreground text-background" : "border-border hover:bg-accent")}>{entry}</button>)}
        </div>
      </Section>

      <Section step={4} title="Memory">
        <div role="radiogroup" aria-label="Memory" className="grid gap-2 sm:grid-cols-2">
          {memoryOptions.map(({ value, title, body, icon: Icon }) => <button key={value} type="button" role="radio" aria-checked={memory === value} disabled={saving} onClick={() => setMemory(value)} className={cn("motion-control relative flex gap-3 rounded-3xl border p-3 text-left transition-colors", memory === value ? "border-foreground bg-secondary" : "border-border hover:bg-accent")}>
            <Icon className="mt-0.5 size-5 shrink-0" />
            <span className="min-w-0"><span className="block text-sm font-medium">{title}</span><span className="block text-xs leading-snug text-muted-foreground">{body}</span></span>
            {memory === value && <Check className="absolute right-3 top-3 size-4" />}
          </button>)}
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button type="button" variant="ghost" className="h-11 flex-1 rounded-full" disabled={saving} onClick={() => navigate(back)}>Cancel</Button>
          <Button type="submit" className="h-11 flex-[2] rounded-full" disabled={!ready || saving}><Plus />{saving ? "Creating…" : "Create project"}</Button>
        </div>
      </div>
    </form>
  </WorkspaceShell>;
}
