import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useLocation } from "@/lib/router-compat";
import { useChatHistory } from "@/context/ChatHistoryContext";
import { supabase } from "@/lib/cloud/client";
import { projectCategories, projectIcons } from "@/lib/project-options";
import WorkspaceShell from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (!user || !name.trim() || !category || saving) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const result = await supabase.from("workspace_projects").insert({ id, name: name.trim(), icon, category, user_id: user.id });
      if (result.error) { toast.error(result.error.message); return; }
      if (chatId && await setChatProject(chatId, id)) { toast.success(`Moved to ${name.trim()}`); navigate(`/chat/${chatId}`); return; }
      navigate("/projects");
    } catch { toast.error("Project couldn’t be created. Please try again."); }
    finally { setSaving(false); }
  };
  return <WorkspaceShell title="Create project" backTo={chatId ? `/chat/${chatId}` : "/projects"}>
    <form className="mx-auto max-w-lg space-y-7" onSubmit={(event) => { event.preventDefault(); void create(); }}>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Project icon <span className="font-normal text-muted-foreground">(optional)</span></legend>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {projectIcons.map(({ value, label, icon: Icon }) => <Button key={value} type="button" variant={icon === value ? "secondary" : "outline"} size="icon" className={`size-11 rounded-lg ${icon === value ? "ring-2 ring-ring" : ""}`} aria-label={label} title={label} aria-pressed={icon === value} onClick={() => setIcon(icon === value ? null : value)}><Icon className="size-5" /></Button>)}
        </div>
      </fieldset>
      <div className="space-y-2"><label htmlFor="project-name" className="text-sm font-medium">Project name</label><Input id="project-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" maxLength={100} required disabled={saving} /></div>
      <div className="space-y-2"><label id="project-category-label" className="text-sm font-medium">Category</label><Select value={category} onValueChange={setCategory} disabled={saving} required><SelectTrigger aria-labelledby="project-category-label"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{projectCategories.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex justify-end gap-2 border-t border-border pt-5"><Button type="button" variant="ghost" disabled={saving} onClick={() => navigate(chatId ? `/chat/${chatId}` : "/projects")}>Cancel</Button><Button type="submit" disabled={!name.trim() || !category || saving}><Plus />{saving ? "Creating…" : "Create"}</Button></div>
    </form>
  </WorkspaceShell>;
}