import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchWorkflowTemplates,
  updateProject,
  type Project,
  type WorkflowTemplateSummary,
} from "@/lib/api";
import type { Session } from "@/lib/session";

type EditProjectModalProps = {
  session: Session;
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (project: Project) => void;
};

export function EditProjectModal({
  session,
  project,
  open,
  onOpenChange,
  onSaved,
}: EditProjectModalProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workflowTemplateId, setWorkflowTemplateId] = useState("");
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);

  useEffect(() => {
    if (!open || !project) return;
    setName(project.name);
    setDescription(project.description.trim());
    setWorkflowTemplateId("");
    void fetchWorkflowTemplates(session)
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open, project, session]);

  async function handleSave() {
    if (!project) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    const currentTemplateId = project.workflowTemplateId.trim();
    const selectedTemplateId = workflowTemplateId.trim();
    const nextTemplateId = selectedTemplateId !== "" ? selectedTemplateId : currentTemplateId;

    setSaving(true);
    try {
      const updated = await updateProject(session, project.id, {
        name: trimmedName,
        description: description.trim(),
        workflowTemplateId: nextTemplateId,
      });
      onSaved(updated);
      onOpenChange(false);
      toast.success("Project updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(name.trim());

  const currentTemplate = project !== null
    ? templates.find((item) => item.id === project.workflowTemplateId)
    : null;
  const selectedTemplateId = workflowTemplateId.trim();
  const pipelineWillChange =
    selectedTemplateId !== "" &&
    project !== null &&
    selectedTemplateId !== project.workflowTemplateId.trim();
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-white/[0.06] px-6 py-4">
          <DialogTitle>Edit project</DialogTitle>
          {project ? (
            <p className="text-xs text-muted-foreground">{project.id}</p>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="edit-project-name">Name</Label>
            <Input
              id="edit-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-project-description">Description</Label>
            <Textarea
              id="edit-project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              disabled={saving}
            />
          </div>
          {templates.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="edit-project-workflow">Pipeline template</Label>
              {currentTemplate ? (
                <p className="text-xs text-muted-foreground">
                  Current: {currentTemplate.title}
                </p>
              ) : project !== null && project.workflowTemplateId ? (
                <p className="text-xs text-muted-foreground">
                  Current: {project.workflowTemplateId}
                </p>
              ) : null}
              <Select
                id="edit-project-workflow"
                value={workflowTemplateId}
                onChange={(event) => setWorkflowTemplateId(event.target.value)}
                disabled={saving}
              >
                <option value="">Keep current pipeline</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </Select>
              {pipelineWillChange ? (
                <p className="text-xs text-amber-400/90">
                  Switching to {selectedTemplate ? selectedTemplate.title : selectedTemplateId} resets existing epic
                  workflows and removes their spawned subtasks.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-white/[0.06] px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button disabled={saving || !canSubmit} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
