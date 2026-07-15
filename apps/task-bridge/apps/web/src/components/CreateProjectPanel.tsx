import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Session } from "@/lib/session";
import { createProject, DEFAULT_WORKFLOW_TEMPLATE_ID, fetchWorkflowTemplates, PROTECTED_WORKFLOW_TEMPLATE_IDS, type Project, type WorkflowTemplateSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type CreateProjectPanelProps = {
  session: Session;
  initialTemplateId?: string;
  onCreated: (project: Project) => void;
  onCancel: () => void;
};

export function CreateProjectPanel({
  session,
  initialTemplateId = "",
  onCreated,
  onCancel,
}: CreateProjectPanelProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [workflowTemplateId, setWorkflowTemplateId] = useState("");

  useEffect(() => {
    void fetchWorkflowTemplates(session)
      .then((items) => {
        setTemplates(items);
        setWorkflowTemplateId((current) => {
          if (initialTemplateId && items.some((item) => item.id === initialTemplateId)) {
            return initialTemplateId;
          }
          if (items.some((item) => item.id === current)) return current;
          for (const item of items) {
            if (item.id === DEFAULT_WORKFLOW_TEMPLATE_ID) {
              return item.id;
            }
          }
          if (items.length > 0) {
            const first = items[0];
            if (first) {
              return first.id;
            }
          }
          return DEFAULT_WORKFLOW_TEMPLATE_ID;
        });
      })
      .catch(() => setTemplates([]));
  }, [session, initialTemplateId]);

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCreating(true);
    try {
      const created = await createProject(session, {
        name: trimmedName,
        id: "",
        description: description.trim(),
        workflowTemplateId: workflowTemplateId.trim() || DEFAULT_WORKFLOW_TEMPLATE_ID,
      });
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  const canSubmit = Boolean(name.trim());
  const predefinedTemplates = templates.filter((t) => PROTECTED_WORKFLOW_TEMPLATE_IDS.has(t.id));
  const ownedTemplates = templates.filter((t) => !PROTECTED_WORKFLOW_TEMPLATE_IDS.has(t.id));

  function renderTemplateOption(template: WorkflowTemplateSummary) {
    return (
      <button
        key={template.id}
        type="button"
        disabled={creating}
        onClick={() => setWorkflowTemplateId(template.id)}
        className={cn(
          "rounded-xl border px-4 py-3 text-left transition-colors",
          workflowTemplateId === template.id
            ? "border-primary bg-primary/10"
            : "border-white/[0.08] hover:border-white/[0.14]",
        )}
      >
        <p className="text-sm font-medium text-white">{template.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{template.description}</p>
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">New project</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pick a starting workflow template.</p>
      </div>

      <div className="panel-card space-y-5 p-6">
        <div className="space-y-2">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My App"
            disabled={creating}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional notes about this project"
            rows={3}
            disabled={creating}
          />
        </div>
        {predefinedTemplates.length > 0 ? (
          <div className="space-y-2">
            <Label>Built-in template</Label>
            <div className="grid gap-2">{predefinedTemplates.map(renderTemplateOption)}</div>
          </div>
        ) : null}
        {ownedTemplates.length > 0 ? (
          <div className="space-y-2">
            <Label>Your templates</Label>
            <div className="grid gap-2">{ownedTemplates.map(renderTemplateOption)}</div>
          </div>
        ) : null}
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Community templates from other users live on the marketplace.
          </p>
          <Link
            to="/marketplace?selectFor=project"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            Browse marketplace
          </Link>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading templates…</p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={creating}>
            Cancel
          </Button>
          <Button disabled={creating || !canSubmit} onClick={() => void handleCreate()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
