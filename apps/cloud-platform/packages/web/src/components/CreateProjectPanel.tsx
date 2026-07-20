import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Session } from "@/lib/session";
import { createProject, DEFAULT_WORKFLOW_TEMPLATE_ID, type Project } from "@/lib/api";

type CreateProjectPanelProps = {
  session: Session;
  onCreated: (project: Project) => void;
  onCancel: () => void;
};

export function CreateProjectPanel({
  session,
  onCreated,
  onCancel,
}: CreateProjectPanelProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCreating(true);
    try {
      const created = await createProject(session, {
        name: trimmedName,
        description: description.trim(),
        workflowTemplateId: DEFAULT_WORKFLOW_TEMPLATE_ID,
      });
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  const canSubmit = Boolean(name.trim());

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">New project</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create the Cloud project that will own its tasks, scripts, and nodes.
        </p>
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
