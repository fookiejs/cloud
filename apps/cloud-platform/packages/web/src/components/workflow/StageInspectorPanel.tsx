import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { DescriptionEditorModal } from "@/components/DescriptionEditorModal";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkflowStage } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import {
  findTemplateInTree,
  patchTemplateInTree,
  removeTemplateFromTree,
} from "./template-graph-utils";
import { syncStageTemplates } from "./workflow-utils";

type StageInspectorPanelProps = {
  stage: WorkflowStage;
  stageCount: number;
  selectedTaskTemplateId: string | null;
  onChange: (stage: WorkflowStage) => void;
  onSelectTaskTemplate: (templateId: string | null) => void;
  onDeleteStage: () => void;
  onClose: () => void;
};

function nodeKindLabel(depth: number) {
  if (depth <= 0) return "Task";
  return "Subtask";
}

function DescriptionField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const trimmed = value.trim();

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="min-h-[4.5rem] rounded-lg border border-white/[0.08] bg-[#0f0f0f] px-3 py-2.5">
        {trimmed ? (
          <MarkdownView content={value} className="text-sm" />
        ) : (
          <p className="text-sm italic text-muted-foreground">No description yet.</p>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Edit description
      </Button>
      <DescriptionEditorModal
        open={open}
        onOpenChange={setOpen}
        title={label}
        value={value}
        onSave={(next) => {
          onChange(next);
          setOpen(false);
        }}
        placeholder={placeholder}
        saving={null}
      />
    </div>
  );
}

export function StageInspectorPanel({
  stage,
  stageCount,
  selectedTaskTemplateId,
  onChange,
  onSelectTaskTemplate,
  onDeleteStage,
  onClose,
}: StageInspectorPanelProps) {
  const { confirmDestructive } = useConfirm();
  const activeTasks = stage.activeTaskCount !== null ? stage.activeTaskCount : 0;
  const canDeleteStage = stageCount > 1 && activeTasks === 0;
  const templates = stage.taskTemplates;
  const selected = selectedTaskTemplateId
    ? findTemplateInTree(templates, selectedTaskTemplateId)
    : null;
  const activeTemplate = selected !== null ? selected.template : null;
  const nodeDepth = selected !== null ? selected.depth : 0;

  function updateStage(patch: Partial<WorkflowStage>) {
    onChange(syncStageTemplates(Object.assign({}, stage, patch)));
  }

  function updateTemplates(next: typeof templates) {
    onChange(syncStageTemplates(Object.assign({}, stage, { taskTemplates: next })));
  }

  function patchTemplate(templateId: string, patch: Parameters<typeof patchTemplateInTree>[2]) {
    updateTemplates(patchTemplateInTree(templates, templateId, patch));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {activeTemplate ? nodeKindLabel(nodeDepth) : "Pipeline step"}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-white">
            {activeTemplate ? activeTemplate.title : stage.title || "Untitled"}
          </p>
          {activeTemplate ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Step: {stage.title || "Untitled"}
              {nodeDepth > 0 ? ` · nested level ${nodeDepth}` : ""}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Use + on the canvas to add tasks</p>
          )}
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {activeTemplate ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={activeTemplate.title}
              onChange={(event) => patchTemplate(activeTemplate.id, { title: event.target.value })}
            />
          </div>
          <DescriptionField
            label="Description"
            value={activeTemplate.description}
            onChange={(next) => patchTemplate(activeTemplate.id, { description: next })}
            placeholder="What should happen in this task?"
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => {
              void (async () => {
                if (!(await confirmDestructive(`Delete "${activeTemplate.title}"?`, null))) {
                  return;
                }
                updateTemplates(removeTemplateFromTree(templates, activeTemplate.id));
                onSelectTaskTemplate(null);
              })();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete node
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stage-title">Title</Label>
            <Input
              id="stage-title"
              value={stage.title}
              onChange={(event) => updateStage({ title: event.target.value })}
            />
          </div>
          <DescriptionField
            label="Description"
            value={stage.description}
            onChange={(next) => updateStage({ description: next })}
            placeholder="Step context, expectations, notes…"
          />
          {stageCount <= 1 ? (
            <p className="text-xs text-muted-foreground">At least one pipeline step is required.</p>
          ) : activeTasks > 0 ? (
            <p className="text-xs text-muted-foreground">
              {activeTasks} epic(s) are on this step and it cannot be deleted.
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={!canDeleteStage}
            className="w-full justify-start text-destructive hover:text-destructive disabled:opacity-40"
            onClick={() => {
              if (!canDeleteStage) return;
              void (async () => {
                if (!(await confirmDestructive(`Delete step "${stage.title || "Untitled"}"?`, null))) return;
                onDeleteStage();
              })();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete step
          </Button>
        </div>
      )}
    </div>
  );
}
