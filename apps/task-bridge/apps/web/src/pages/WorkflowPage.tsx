import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { StageInspectorPanel } from "@/components/workflow/StageInspectorPanel";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { WorkflowInspectorSidebar } from "@/components/workflow/WorkflowInspectorSidebar";
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
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { TeamPanel } from "@/components/workflow/TeamPanel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import {
  createMember,
  deleteMember,
  fetchProjectWorkflow,
  saveProjectWorkflow,
  type ProjectMember,
  type WorkflowStage,
} from "@/lib/api";

export function WorkflowPage() {
  const params = useParams();
  let projectId = "";
  if (typeof params["projectId"] === "string" && params["projectId"].length > 0) {
    projectId = params["projectId"];
  }
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [selectedTaskTemplateId, setSelectedTaskTemplateId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPulse, setSidebarPulse] = useState(0);
  const [activeTab, setActiveTab] = useState("stages");
  const sidebarPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reload = useCallback(async () => {
    if (!session || !projectId) return;
    setLoading(true);
    try {
      const workflow = await fetchProjectWorkflow(session, projectId);
      setStages(workflow.stages);
      setMembers(workflow.members);
      setDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [session, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return () => {
      if (sidebarPulseTimerRef.current) clearTimeout(sidebarPulseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "stages") {
      setSidebarOpen(false);
    }
  }, [activeTab]);

  function revealSidebar() {
    if (sidebarPulseTimerRef.current) clearTimeout(sidebarPulseTimerRef.current);
    setSidebarOpen(false);
    sidebarPulseTimerRef.current = setTimeout(() => {
      setSidebarOpen(true);
      setSidebarPulse((value) => value + 1);
      sidebarPulseTimerRef.current = null;
    }, 130);
  }

  function markDirty(next: WorkflowStage[]) {
    setStages(next.slice().sort((a, b) => a.position - b.position));
    setDirty(true);
  }

  function selectNewStage(next: WorkflowStage[], index: number, taskTemplateId: string | null = null) {
    markDirty(next);
    setEditorIndex(index);
    setSelectedTaskTemplateId(taskTemplateId);
    revealSidebar();
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
    const target = index + delta;
    setEditorIndex(target);
  }

  async function handleSaveStages() {
    if (!session) return;
    setSaving(true);
    try {
      const workflow = await saveProjectWorkflow(session, projectId, { stages, roles: [] });
      setStages(workflow.stages);
      setDirty(false);
      toast.success("Workflow saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  }

  function updateStageAt(index: number, stage: WorkflowStage) {
    markDirty(stages.map((item, idx) => (idx === index ? syncStageTemplates(stage) : item)));
  }

  function removeStageAt(index: number) {
    if (stages.length <= 1) {
      toast.error("At least one pipeline step is required");
      return;
    }
    const stage = stages[index];
    if (!stage) {
      return;
    }
    const activeTasks = stage.activeTaskCount !== null ? stage.activeTaskCount : 0;
    if (activeTasks > 0) {
      toast.error(`${activeTasks} epic(s) are on this step and it cannot be deleted`);
      return;
    }
    markDirty(
      stages.filter((_, idx) => idx !== index).map((stage, position) => Object.assign({}, stage, { position })),
    );
    setEditorIndex(null);
    setSelectedTaskTemplateId(null);
    setSidebarOpen(false);
  }

  async function handleCreateMember(input: { name: string; role: string }) {
    if (!session) return;
    const member = await createMember(session, projectId, input);
    setMembers((current) => current.concat([member]).sort((a, b) => a.name.localeCompare(b.name)));
    toast.success("Member added");
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

  function selectFromCanvas(sortedIndex: number, taskTemplateId: string | null = null) {
    setStageBySortedIndex(sortedIndex, taskTemplateId);
    revealSidebar();
  }

  function closeInspector() {
    setEditorIndex(null);
    setSelectedTaskTemplateId(null);
    setSidebarOpen(false);
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  let projectLabel = "Project";
  if (session !== null && session.projectName !== null) {
    projectLabel = session.projectName;
  } else if (projectId.length > 0) {
    projectLabel = projectId;
  }
  let projectTasksPath = "/projects";
  if (projectId.length > 0) {
    projectTasksPath = `/projects/${projectId}/tasks`;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        breadcrumb={[
          { label: "Projects", to: "/projects" },
          { label: projectLabel, to: projectTasksPath },
          { label: "Pipeline", to: null },
        ]}
        title="Pipeline"
        subtitle="Pipeline steps and task templates · epics run this workflow"
        actions={
          <>
            {dirty ? (
              <span className="rounded-full border border-warn/30 bg-warn/10 px-2.5 py-1 text-xs font-medium text-warn">
                Unsaved changes
              </span>
            ) : null}
            <Button onClick={() => void handleSaveStages()} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save workflow
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-white/[0.06] px-5">
          <TabsList className="h-10 bg-transparent p-0">
            <TabsTrigger value="stages" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Team
            </TabsTrigger>
          </TabsList>
        </div>

        <div className={cn("flex min-h-0 flex-1", activeTab !== "stages" && "hidden")}>
          <WorkflowCanvas
              className="min-h-0 flex-1"
              stages={stages}
              selectedStageId={editingStage !== null ? editingStage.id : null}
              selectedTaskTemplateId={selectedTaskTemplateId}
              onAddStage={addStageAtEnd}
              onInsertStageAfter={insertStageAfter}
              onMoveStage={moveStage}
              onSelectStage={(flowIndex) => selectFromCanvas(flowIndex, null)}
              onSelectTaskTemplate={(flowIndex, templateId) => selectFromCanvas(flowIndex, templateId)}
              onAddStageTask={(flowIndex) => addStageTask(flowIndex)}
              onAddSubtask={(flowIndex, parentId) => addSubtask(flowIndex, parentId)}
              onMoveTaskTemplate={(flowIndex, templateId, delta) =>
                moveTaskTemplate(flowIndex, templateId, delta)
              }
            />
            <WorkflowInspectorSidebar
              open={sidebarOpen && (editingStage !== null || selectedTaskTemplateId !== null)}
              pulseKey={sidebarPulse}
              onOpenChange={(next) => {
                if (!next) closeInspector();
                else if (editingStage) setSidebarOpen(true);
              }}
            >
              {editingStage ? (
                <StageInspectorPanel
                  stage={editingStage}
                  stageCount={stages.length}
                  selectedTaskTemplateId={selectedTaskTemplateId}
                  onChange={(stage) => {
                    if (editorIndex === null) return;
                    updateStageAt(editorIndex, stage);
                  }}
                  onSelectTaskTemplate={setSelectedTaskTemplateId}
                  onDeleteStage={() => {
                    if (editorIndex === null) return;
                    removeStageAt(editorIndex);
                  }}
                  onClose={closeInspector}
                />
              ) : null}
            </WorkflowInspectorSidebar>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto", activeTab !== "members" && "hidden")}>
          <TeamPanel
              members={members}
              onCreateMember={async (input) => {
                try {
                  await handleCreateMember(input);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to add member");
                }
              }}
              onDeleteMember={async (id, name) => {
                if (!session) return;
                try {
                  await deleteMember(session, projectId, id);
                  setMembers((current) => current.filter((item) => item.id !== id));
                  toast.success(`Deleted "${name}"`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to delete member");
                }
              }}
            />
        </div>
      </Tabs>
    </div>
  );
}
