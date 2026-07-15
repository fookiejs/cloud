import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Plus, Save, ShoppingBag, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { StageInspectorPanel } from "@/components/workflow/StageInspectorPanel";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import {
  addChildTemplate,
  createStageTaskTemplate,
  createSubtaskTemplate,
  findTemplateInTree,
  moveTemplateAmongSiblings,
} from "@/components/workflow/template-graph-utils";
import {
  createEmptyStage,
  insertStageAt,
  moveStageBy,
  syncStageTemplates,
} from "@/components/workflow/workflow-utils";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  exportWorkflowTemplate,
  fetchWorkflowTemplate,
  fetchWorkflowTemplates,
  importWorkflowTemplate,
  PROTECTED_WORKFLOW_TEMPLATE_IDS,
  saveWorkflowTemplate,
  type WorkflowStage,
  type WorkflowTemplate,
  type WorkflowTemplateSummary,
} from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { cn } from "@/lib/utils";

export function WorkflowTemplatesPage() {
  const session = useSession();
  const navigate = useNavigate();
  const { confirmDestructive } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [selectedTaskTemplateId, setSelectedTaskTemplateId] = useState<string | null>(null);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    if (!session) return;
    const items = await fetchWorkflowTemplates(session);
    setTemplates(items);
    if (items.length > 0 && !selectedId) {
      const first = items[0];
      if (first) {
        setSelectedId(first.id);
      }
    }
  }, [session, selectedId]);

  const loadTemplateStages = useCallback(async () => {
    if (!session || !selectedId) return;
    setLoading(true);
    try {
      const template = await fetchWorkflowTemplate(session, selectedId);
      setStages(template.stages);
      setDirty(false);
      setEditorIndex(null);
      setSelectedTaskTemplateId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [session, selectedId]);

  useEffect(() => {
    void loadTemplates().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load templates");
    });
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedId) {
      void loadTemplateStages();
    }
  }, [loadTemplateStages, selectedId]);

  function markDirty(next: WorkflowStage[]) {
    setStages(next.slice().sort((a, b) => a.position - b.position));
    setDirty(true);
  }

  function selectNewStage(next: WorkflowStage[], index: number, taskTemplateId: string | null = null) {
    markDirty(next);
    setEditorIndex(index);
    setSelectedTaskTemplateId(taskTemplateId);
  }

  function addStageAtEnd() {
    const next = stages.concat([createEmptyStage(stages.length)]);
    selectNewStage(next, next.length - 1);
  }

  function insertStageAfter(afterIndex: number) {
    const stage = createEmptyStage(afterIndex + 1);
    const next = insertStageAt(stages, afterIndex, stage);
    selectNewStage(next, afterIndex + 1);
  }

  function moveStage(index: number, delta: -1 | 1) {
    const next = moveStageBy(stages, index, delta);
    if (next === stages) return;
    markDirty(next);
    setEditorIndex(index + delta);
  }

  async function handleCreateTemplate() {
    if (!session || !newTemplateTitle.trim()) return;
    if (dirty && !window.confirm("You have unsaved changes. Continue anyway?")) return;
    setCreatingTemplate(true);
    try {
      const template = await createWorkflowTemplate(session, {
        title: newTemplateTitle.trim(),
        id: "",
        description: "",
      });
      setTemplates((current) =>
        current
          .concat([{ id: template.id, title: template.title, description: template.description }])
          .sort((a, b) => a.title.localeCompare(b.title)),
      );
      setSelectedId(template.id);
      setStages(template.stages);
      setDirty(false);
      setEditorIndex(null);
      setSelectedTaskTemplateId(null);
      setNewTemplateTitle("");
      toast.success("Template created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create template");
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function handleExport() {
    if (!session || !selectedId) return;
    try {
      await exportWorkflowTemplate(session, selectedId);
    } catch {
      toast.error("Export failed");
    }
  }

  async function handleImportFile(file: File) {
    if (!session) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as WorkflowTemplate;
      const template = await importWorkflowTemplate(session, data);
      setTemplates((current) =>
        current
          .concat([{ id: template.id, title: template.title, description: template.description }])
          .sort((a, b) => a.title.localeCompare(b.title)),
      );
      setSelectedId(template.id);
      setStages(template.stages);
      setDirty(false);
      setEditorIndex(null);
      setSelectedTaskTemplateId(null);
      toast.success(`Imported "${template.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed — check file format");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function handleDeleteTemplate(template: WorkflowTemplateSummary) {
    if (!session || PROTECTED_WORKFLOW_TEMPLATE_IDS.has(template.id)) return;
    if (!(await confirmDestructive(`Delete template "${template.title}"? This cannot be undone.`, null))) {
      return;
    }
    setDeleting(true);
    try {
      await deleteWorkflowTemplate(session, template.id);
      const remaining = templates.filter((item) => item.id !== template.id);
      setTemplates(remaining);
      if (selectedId === template.id) {
        let nextSelectedId: string | null = null;
        if (remaining.length > 0) {
          const nextSelected = remaining[0];
          if (nextSelected) {
            nextSelectedId = nextSelected.id;
          }
        }
        setSelectedId(nextSelectedId);
        setStages([]);
        setDirty(false);
        setEditorIndex(null);
        setSelectedTaskTemplateId(null);
      }
      toast.success(`Deleted "${template.title}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  }

  const selectedTemplate = (function(){ const f = templates.find((item) => item.id === selectedId); return f ? f : null; })();
  const canDeleteSelected =
    selectedTemplate !== null && !PROTECTED_WORKFLOW_TEMPLATE_IDS.has(selectedTemplate.id);

  async function handleSave() {
    if (!session || !selectedId) return;
    setSaving(true);
    try {
      const template = await saveWorkflowTemplate(session, selectedId, stages);
      setStages(template.stages);
      setDirty(false);
      toast.success("Template saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  let editingStage: WorkflowStage | null = null;
  if (editorIndex !== null && editorIndex >= 0 && editorIndex < stages.length) {
    const stageAtIndex = stages[editorIndex];
    if (stageAtIndex) {
      editingStage = stageAtIndex;
    }
  }

  function setStageBySortedIndex(sortedIndex: number | null, taskTemplateId: string | null = null) {
    if (sortedIndex === null) {
      setEditorIndex(null);
      setSelectedTaskTemplateId(null);
      return;
    }
    const sorted = stages.slice().sort((a, b) => a.position - b.position);
    const stage = sorted[sortedIndex];
    if (!stage) return;
    const index = stages.findIndex((item) => item.id === stage.id);
    setEditorIndex(index >= 0 ? index : null);
    setSelectedTaskTemplateId(taskTemplateId);
  }

  function stageAtSortedIndex(sortedIndex: number) {
    const sorted = stages.slice().sort((a, b) => a.position - b.position);
    const stage = sorted[sortedIndex];
    if (!stage) return null;
    const index = stages.findIndex((item) => item.id === stage.id);
    if (index < 0) return null;
    return { stage, index };
  }

  function addStageTask(sortedIndex: number) {
    const entry = stageAtSortedIndex(sortedIndex);
    if (!entry) return;
    const templates = (entry.stage.taskTemplates);
    const created = createStageTaskTemplate(entry.stage.title, templates.length);
    const next = stages.map((item, idx) =>
      idx === entry.index
        ? syncStageTemplates(Object.assign({}, item, { taskTemplates: templates.concat([created]) }))
        : item,
    );
    selectNewStage(next, entry.index, created.id);
  }

  function moveTaskTemplate(sortedIndex: number, templateId: string, delta: -1 | 1) {
    const entry = stageAtSortedIndex(sortedIndex);
    if (!entry) return;
    const templates = (entry.stage.taskTemplates);
    const next = stages.map((item, idx) =>
      idx === entry.index
        ? syncStageTemplates(
            Object.assign({}, item, {
              taskTemplates: moveTemplateAmongSiblings(templates, templateId, delta),
            }),
          )
        : item,
    );
    markDirty(next);
  }

  function addSubtask(sortedIndex: number, parentTemplateId: string) {
    const entry = stageAtSortedIndex(sortedIndex);
    if (!entry) return;
    const templates = (entry.stage.taskTemplates);
    const parent = findTemplateInTree(templates, parentTemplateId);
    if (!parent) return;
    const created = createSubtaskTemplate(
      parent.template.title,
      parent.template.children.length,
    );
    const next = stages.map((item, idx) =>
      idx === entry.index
        ? syncStageTemplates(
            Object.assign({}, item, {
              taskTemplates: addChildTemplate(templates, parentTemplateId, created),
            }),
          )
        : item,
    );
    selectNewStage(next, entry.index, created.id);
  }

  if (!session) return null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-white/[0.07] bg-black">
        <div className="space-y-2 border-b border-white/[0.06] px-3 py-3">
          <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Templates</p>
          <div className="flex h-9 w-full overflow-hidden rounded-lg border border-white/[0.1] bg-[#111111] shadow-sm ring-offset-black focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-black">
            <input
              value={newTemplateTitle}
              onChange={(event) => setNewTemplateTitle(event.target.value)}
              placeholder="New template"
              disabled={creatingTemplate}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              onKeyDown={(event) => {
                if (event.key === "Enter" && newTemplateTitle.trim()) {
                  event.preventDefault();
                  void handleCreateTemplate();
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-full w-9 shrink-0 rounded-none border-l border-white/[0.1] hover:bg-white/[0.06]"
              disabled={!newTemplateTitle.trim() || creatingTemplate}
              onClick={() => void handleCreateTemplate()}
            >
              {creatingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          {/* Import from JSON file */}
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = (e.target.files !== null ? e.target.files[0] : null);
              if (file) void handleImportFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full"
            disabled={importing}
            onClick={() => {
              if (importInputRef.current !== null) {
                importInputRef.current.click();
              }
            }}
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Import JSON
          </Button>
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {templates.map((template) => (
            <div key={template.id} className="group relative">
              <button
                type="button"
                onClick={() => {
                  if (dirty && !window.confirm("Discard unsaved changes?")) return;
                  setSelectedId(template.id);
                }}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 pr-16 text-left transition-colors",
                  selectedId === template.id
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                <p className="text-sm font-medium">{template.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.description}</p>
              </button>
              {/* Export button — visible on hover or when selected */}
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                <button
                  type="button"
                  title="Export as JSON"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(template.id);
                    void exportWorkflowTemplate(session, template.id).catch(() =>
                      toast.error("Export failed"),
                    );
                  }}
                  className={cn(
                    "rounded p-1 transition-opacity",
                    "text-muted-foreground hover:text-foreground",
                    selectedId === template.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {!PROTECTED_WORKFLOW_TEMPLATE_IDS.has(template.id) ? (
                  <button
                    type="button"
                    title="Delete template"
                    disabled={deleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteTemplate(template);
                    }}
                    className={cn(
                      "rounded p-1 transition-opacity",
                      "text-muted-foreground hover:text-destructive",
                      selectedId === template.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title={selectedTemplate !== null ? selectedTemplate.title : "Template"}
          subtitle="Stages and task templates"
          actions={
            <>
              {dirty ? (
                <span className="rounded-full border border-warn/30 bg-warn/10 px-2.5 py-1 text-xs font-medium text-warn">
                  Unsaved
                </span>
              ) : null}
              {selectedId && !PROTECTED_WORKFLOW_TEMPLATE_IDS.has(selectedId) ? (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/marketplace?publish=${encodeURIComponent(selectedId)}`)}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Share on marketplace
                </Button>
              ) : null}
              {selectedId ? (
                <Button variant="outline" onClick={() => void handleExport()}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              ) : null}
              {canDeleteSelected && selectedTemplate ? (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={deleting}
                  onClick={() => void handleDeleteTemplate(selectedTemplate)}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </Button>
              ) : null}
              <Button onClick={() => void handleSave()} disabled={saving || !dirty || !selectedId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </>
          }
        />

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <WorkflowCanvas
              className="min-h-0 flex-1"
              stages={stages}
              selectedStageId={editingStage !== null ? editingStage.id : null}
              selectedTaskTemplateId={selectedTaskTemplateId}
              onAddStage={addStageAtEnd}
              onInsertStageAfter={insertStageAfter}
              onMoveStage={moveStage}
              onSelectStage={(flowIndex) => setStageBySortedIndex(flowIndex, null)}
              onSelectTaskTemplate={(flowIndex, templateId) => setStageBySortedIndex(flowIndex, templateId)}
              onAddStageTask={(flowIndex) => addStageTask(flowIndex)}
              onAddSubtask={(flowIndex, parentId) => addSubtask(flowIndex, parentId)}
              onMoveTaskTemplate={(flowIndex, templateId, delta) =>
                moveTaskTemplate(flowIndex, templateId, delta)
              }
            />
            <aside className="flex w-[380px] shrink-0 flex-col border-l border-white/[0.07] bg-[#0a0a0a]">
              <div className="flex-1 overflow-y-auto p-4">
            {editingStage ? (
              <StageInspectorPanel
                stage={editingStage}
                stageCount={stages.length}
                selectedTaskTemplateId={selectedTaskTemplateId}
                onChange={(stage) => {
                  if (editorIndex === null) return;
                  markDirty(stages.map((item, idx) => (idx === editorIndex ? syncStageTemplates(stage) : item)));
                }}
                onSelectTaskTemplate={setSelectedTaskTemplateId}
                onDeleteStage={() => {
                  if (editorIndex === null) return;
                  if (stages.length <= 1) {
                    toast.error("At least one stage is required");
                    return;
                  }
                  markDirty(
                    stages.filter((_, idx) => idx !== editorIndex).map((stage, position) => Object.assign({}, stage, { position })),
                  );
                  setEditorIndex(null);
                  setSelectedTaskTemplateId(null);
                }}
                onClose={() => {
                  setEditorIndex(null);
                  setSelectedTaskTemplateId(null);
                }}
              />
            ) : null}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
