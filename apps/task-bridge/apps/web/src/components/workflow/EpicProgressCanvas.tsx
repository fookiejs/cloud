import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskSubtask, WorkflowStateNode, WorkStatus, WorkflowStage } from "@/lib/api";
import { flattenTemplates, sanitizeStageTemplates } from "./template-graph-utils";
import { NodeAddButton } from "./NodeAddButton";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  STAGE_CARD_HEIGHT,
  STAGE_CARD_WIDTH,
  STEP_TASK_GAP,
  TASK_DEPTH_INDENT,
  TASK_NODE_WIDTH,
  type DisplayStage,
  beginPanPointer,
  bindCanvasWheelZoom,
  bindPanDrag,
  type PanDragState,
  stageLayoutKey,
  stageStackHeight,
  stagesForDisplay,
} from "./workflow-utils";

export type TemplateRuntimeStatus = {
  taskId: number | null;
  workStatus: WorkStatus;
  workStatusLabel: string;
};

type EpicProgressCanvasProps = {
  stages: WorkflowStage[];
  epicId: number;
  epicStageId: string | null;
  subtasks: TaskSubtask[];
  workflowState: WorkflowStateNode[] | null;
  selectedTaskId: number | null;
  onSelectTask: ((taskId: number) => void) | null;
  onAddTaskToStage: ((stageId: string, stageTitle: string) => void) | null;
  onAddSubtask: ((parentTaskId: number, parentTitle: string, stageId: string | null) => void) | null;
  className: string | null;
};

type Point = { x: number; y: number };

type StagePhase = "complete" | "current" | "upcoming";

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stageConnectorPoints(from: DisplayStage, to: DisplayStage) {
  return {
    start: { x: from.displayX + STAGE_CARD_WIDTH, y: from.displayY + STAGE_CARD_HEIGHT / 2 },
    end: { x: to.displayX, y: to.displayY + STAGE_CARD_HEIGHT / 2 },
  };
}

function connectorPath(from: DisplayStage, to: DisplayStage) {
  const { start, end } = stageConnectorPoints(from, to);
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

function resolveStagePhase(
  stage: WorkflowStage,
  epicStageId: string | null,
  sortedStages: WorkflowStage[],
): StagePhase {
  if (!epicStageId) return "upcoming";
  const epicIndex = sortedStages.findIndex((entry) => entry.id === epicStageId);
  const stageIndex = sortedStages.findIndex((entry) => entry.id === stage.id);
  if (epicIndex < 0 || stageIndex < 0) return "upcoming";
  if (stageIndex < epicIndex) return "complete";
  if (stageIndex === epicIndex) return "current";
  return "upcoming";
}

function toRuntime(subtask: TaskSubtask): TemplateRuntimeStatus {
  let workStatus = subtask.workStatus;
  if (workStatus === null) {
    workStatus = subtask.done ? "done" : "todo";
  }
  let workStatusLabel = subtask.workStatusLabel;
  if (workStatusLabel === null) {
    workStatusLabel = workStatus;
  }
  return {
    taskId: subtask.taskId,
    workStatus,
    workStatusLabel,
  };
}

function toRuntimeFromState(node: WorkflowStateNode): TemplateRuntimeStatus {
  return {
    taskId: node.taskId,
    workStatus: node.workStatus,
    workStatusLabel: node.workStatusLabel,
  };
}

function resolveSubtaskStageId(subtasks: TaskSubtask[], subtask: TaskSubtask, epicId: number) {
  if (subtask.stageId) return subtask.stageId;
  if (!subtask.parentId || subtask.parentId === epicId) return null;
  const parent = subtasks.find((entry) => entry.taskId === subtask.parentId);
  if (!parent) return null;
  return resolveSubtaskStageId(subtasks, parent, epicId);
}

function prepareCanvasSubtasks(
  stages: WorkflowStage[],
  epicStageId: string | null,
  subtasks: TaskSubtask[],
  epicId: number,
) {
  const stageIds = new Set(stages.map((stage) => stage.id));
  let fallbackStageId: string | null = null;
  if (epicStageId && stageIds.has(epicStageId)) {
    fallbackStageId = epicStageId;
  }
  if (fallbackStageId === null) {
    const stageWithTemplates = stages.find((stage) => stage.taskTemplates.length > 0);
    if (stageWithTemplates) {
      fallbackStageId = stageWithTemplates.id;
    }
  }
  if (fallbackStageId === null && stages.length > 0) {
    const firstStage = stages[0];
    if (firstStage) {
      fallbackStageId = firstStage.id;
    }
  }

  return subtasks.map((subtask) => {
    let stageId = resolveSubtaskStageId(subtasks, subtask, epicId);
    if (stageId === null) {
      stageId = subtask.stageId;
    }
    if (stageId && !stageIds.has(stageId) && fallbackStageId) {
      stageId = fallbackStageId;
    }
    if (!stageId && fallbackStageId) {
      stageId = fallbackStageId;
    }
    if (stageId === subtask.stageId) return subtask;
    return Object.assign({}, subtask, { stageId });
  });
}

function hasRenderedParentOnStage(
  subtasks: TaskSubtask[],
  entry: TaskSubtask,
  stageId: string,
  epicId: number,
  renderedTaskIds: Set<number>,
) {
  let parentId = (entry.parentId !== null ? entry.parentId : null);
  while (parentId && parentId !== epicId) {
    if (renderedTaskIds.has(parentId)) {
      const parent = subtasks.find((candidate) => candidate.taskId === parentId);
      if (parent && parent.stageId === stageId) return true;
    }
    const parentEntry = subtasks.find((candidate) => candidate.taskId === parentId);
    if (parentEntry) {
      parentId = parentEntry.parentId;
    } else {
      parentId = null;
    }
  }
  return false;
}

function buildStatusLookup(
  subtasks: TaskSubtask[],
  stageId: string,
  workflowState: WorkflowStateNode[],
) {
  const byTemplateId = new Map<string, TemplateRuntimeStatus>();
  for (const node of workflowState) {
    if (node.stageId !== stageId) continue;
    byTemplateId.set(node.templateId, toRuntimeFromState(node));
  }
  for (const subtask of subtasks) {
    if (subtask.stageId !== stageId) continue;
    if (!subtask.templateId) continue;
    byTemplateId.set(subtask.templateId, toRuntime(subtask));
  }
  return byTemplateId;
}

function runtimeForTemplate(
  templateId: string,
  stageId: string,
  subtasks: TaskSubtask[],
  statusByTemplateId: Map<string, TemplateRuntimeStatus>,
) {
  const mapped = statusByTemplateId.get(templateId);
  if (mapped) return mapped;
  const subtask = subtasks.find(
    (entry) => entry.templateId === templateId && entry.stageId === stageId,
  );
  return subtask ? toRuntime(subtask) : null;
}

function unplacedStageSubtasks(
  stageId: string,
  subtasks: TaskSubtask[],
  epicId: number,
  templatePlacedTaskIds: Set<number>,
  renderedTaskIds: Set<number>,
) {
  return subtasks.filter((entry) => {
    if (entry.stageId !== stageId) return false;
    if (templatePlacedTaskIds.has(entry.taskId)) return false;
    if (renderedTaskIds.has(entry.taskId)) return false;
    if (hasRenderedParentOnStage(subtasks, entry, stageId, epicId, renderedTaskIds)) return false;
    return true;
  });
}

function collectTemplatePlacedTaskIds(
  templates: ReturnType<typeof sanitizeStageTemplates>,
  stageId: string,
  subtasks: TaskSubtask[],
  statusByTemplateId: Map<string, TemplateRuntimeStatus>,
) {
  const ids = new Set<number>();
  function walk(nodes: ReturnType<typeof sanitizeStageTemplates>) {
    for (const node of nodes) {
      const runtime = runtimeForTemplate(node.id, stageId, subtasks, statusByTemplateId);
      if (runtime !== null && runtime.taskId !== null) {
        ids.add(runtime.taskId);
      }
      if (node.children.length > 0) walk(sanitizeStageTemplates(node.children));
    }
  }
  walk(templates);
  return ids;
}

function childSubtasksForParent(
  subtasks: TaskSubtask[],
  parentId: number,
  excludeTaskIds: Set<number>,
  renderedTaskIds: Set<number>,
) {
  return subtasks.filter((entry) => {
    if (entry.parentId !== parentId) return false;
    if (entry.templateId) return false;
    if (excludeTaskIds.has(entry.taskId)) return false;
    if (renderedTaskIds.has(entry.taskId)) return false;
    renderedTaskIds.add(entry.taskId);
    return true;
  });
}

function epicRootSubtasksForStage(
  stageId: string,
  subtasks: TaskSubtask[],
  epicId: number,
  templatePlacedTaskIds: Set<number>,
  renderedTaskIds: Set<number>,
) {
  return subtasks.filter(
    (entry) =>
      entry.stageId === stageId &&
      entry.parentId === epicId &&
      !templatePlacedTaskIds.has(entry.taskId) &&
      !renderedTaskIds.has(entry.taskId),
  );
}

function remainingStageSubtasks(
  stageId: string,
  subtasks: TaskSubtask[],
  renderedTaskIds: Set<number>,
  templatePlacedTaskIds: Set<number>,
) {
  return subtasks.filter(
    (entry) =>
      entry.stageId === stageId &&
      !renderedTaskIds.has(entry.taskId) &&
      !templatePlacedTaskIds.has(entry.taskId),
  );
}

function stageSubtaskStats(stageId: string, subtasks: TaskSubtask[]) {
  const items = subtasks.filter((entry) => entry.stageId === stageId);
  const done = items.filter((entry) => entry.done).length;
  const inProgress = items.filter((entry) => entry.workStatus === "in_progress").length;
  return { total: items.length, done, inProgress };
}

function statusNodeClass(workStatus: WorkStatus | null, spawned: boolean, selected: boolean) {
  if (selected) {
    return "border-blue-500/70 bg-blue-500/15 text-blue-50 shadow-[0_0_0_1px_rgba(59,130,246,0.45)]";
  }
  if (!spawned) {
    return "border-dashed border-white/[0.14] bg-white/[0.02] text-muted-foreground";
  }
  if (workStatus === "done") {
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100 hover:border-emerald-500/50";
  }
  if (workStatus === "in_progress") {
    return "border-yellow-500/45 bg-yellow-500/10 text-yellow-50 hover:border-yellow-500/60";
  }
  return "border-zinc-500/35 bg-zinc-500/10 text-zinc-200 hover:border-zinc-400/45";
}

function StatusIcon({ workStatus, spawned }: { workStatus: WorkStatus | null; spawned: boolean }) {
  if (!spawned) return <Circle className="h-3 w-3 shrink-0 text-white/25" />;
  if (workStatus === "done") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  if (workStatus === "in_progress") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-yellow-400" />;
  return <Circle className="h-3 w-3 shrink-0 text-zinc-400" />;
}

function ProgressStageCard({
  stage,
  flowIndex,
  phase,
  stats,
}: {
  stage: DisplayStage;
  flowIndex: number;
  phase: StagePhase;
  stats: { total: number; done: number; inProgress: number };
}) {
  return (
    <div
      className={cn(
        "relative flex w-full shrink-0 select-none flex-col overflow-hidden rounded-2xl border bg-[#161616] shadow-lg",
        phase === "current" && "border-primary/50 shadow-[0_0_0_1px_rgba(96,165,250,0.25)]",
        phase === "complete" && "border-emerald-500/25",
        phase === "upcoming" && "border-white/[0.08] opacity-80",
      )}
      style={{ height: STAGE_CARD_HEIGHT }}
    >
      <div className="flex items-center justify-center border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">{flowIndex + 1}</span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-between gap-2 px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug text-white">
          {stage.title || "Untitled"}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {phase === "current" ? (
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
              Active
            </span>
          ) : null}
          {stats.total > 0 ? (
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground">
              {stats.done}/{stats.total} done
              {stats.inProgress > 0 ? ` · ${stats.inProgress} active` : ""}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NodeLink(rawProps: Partial<{ className: string | null }> = {}) {
  let className: string | null = null;
  if ("className" in rawProps) {
    if (rawProps.className === null) {
      className = null;
    } else if (typeof rawProps.className === "string") {
      className = rawProps.className;
    }
  }
  return <div className={cn("shrink-0 bg-white/[0.14]", className)} />;
}

function ProgressTaskNode({
  title,
  depth,
  runtime,
  selected,
  adHoc,
  onSelect,
  onAddSubtask,
}: {
  title: string;
  depth: number;
  runtime: TemplateRuntimeStatus | null;
  selected: boolean;
  adHoc: boolean | null;
  onSelect: (() => void) | null;
  onAddSubtask: (() => void) | null;
}) {
  const spawned = runtime !== null && runtime.taskId !== null;
  const workStatus = runtime !== null ? runtime.workStatus : null;
  const indent = depth * TASK_DEPTH_INDENT;

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <div className="flex items-center" style={{ paddingLeft: indent }}>
        {depth > 0 ? (
          <div className="relative mr-1 h-10 w-6 shrink-0">
            <NodeLink className="absolute right-0 top-1/2 h-px w-4 -translate-y-1/2" />
            <NodeLink className="absolute right-3 top-0 h-1/2 w-px" />
          </div>
        ) : null}
        <button
          type="button"
          data-epic-task="true"
          disabled={!spawned}
          onClick={(event) => {
            event.stopPropagation();
            if (spawned && onSelect !== null) {
              onSelect();
            }
          }}
          className={cn(
            "pointer-events-auto flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
            statusNodeClass(workStatus, spawned, selected),
            spawned ? "cursor-pointer" : "cursor-default",
          )}
          style={{ width: TASK_NODE_WIDTH, minHeight: 40 }}
        >
          <StatusIcon workStatus={workStatus} spawned={spawned} />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
          <span className="shrink-0 text-[10px] opacity-80">
            {adHoc
              ? "Ad-hoc"
              : spawned
                ? runtime !== null && runtime.workStatusLabel !== null
                  ? runtime.workStatusLabel
                  : "Todo"
                : workStatus
                  ? runtime !== null && runtime.workStatusLabel !== null
                    ? runtime.workStatusLabel
                    : "Todo"
                  : "Pending"}
          </span>
        </button>
        {spawned && onAddSubtask ? (
          <>
            <NodeLink className="mx-1 h-px w-3" />
            <NodeAddButton title="Add subtask" dataEpicAdd="true" onClick={onAddSubtask} className={null} disabled={null} style={null} dataNodeInsert={null} dataStageInsert={null} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ProgressChildTasks({
  parentTaskId,
  depth,
  subtasks,
  excludeTaskIds,
  renderedTaskIds,
  selectedTaskId,
  onSelectTask,
  onAddSubtask,
}: {
  parentTaskId: number;
  depth: number;
  subtasks: TaskSubtask[];
  excludeTaskIds: Set<number>;
  renderedTaskIds: Set<number>;
  selectedTaskId: number | null;
  onSelectTask: ((taskId: number) => void) | null;
  onAddSubtask: ((parentTaskId: number, parentTitle: string) => void) | null;
}) {
  const children = childSubtasksForParent(subtasks, parentTaskId, excludeTaskIds, renderedTaskIds);
  if (children.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {children.map((subtask) => {
        const runtime = toRuntime(subtask);
        return (
          <div key={subtask.taskId} className="flex flex-col gap-2">
            <ProgressTaskNode
              title={subtask.title}
              depth={depth}
              runtime={runtime}
              selected={subtask.taskId === selectedTaskId}
              adHoc
              onSelect={() => {
                if (onSelectTask !== null) {
                  onSelectTask(subtask.taskId);
                }
              }}
              onAddSubtask={
                onAddSubtask ? () => onAddSubtask(subtask.taskId, subtask.title) : null
              }
            />
            <ProgressChildTasks
              parentTaskId={subtask.taskId}
              depth={depth + 1}
              subtasks={subtasks}
              excludeTaskIds={excludeTaskIds}
              renderedTaskIds={renderedTaskIds}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              onAddSubtask={onAddSubtask}
            />
          </div>
        );
      })}
    </div>
  );
}

function buildProgressTaskTree({
  templates,
  depth,
  stageId,
  subtasks,
  excludeTaskIds,
  renderedTaskIds,
  statusByTemplateId,
  selectedTaskId,
  onSelectTask,
  onAddSubtask,
}: {
  templates: ReturnType<typeof sanitizeStageTemplates>;
  depth: number;
  stageId: string;
  subtasks: TaskSubtask[];
  excludeTaskIds: Set<number>;
  renderedTaskIds: Set<number>;
  statusByTemplateId: Map<string, TemplateRuntimeStatus>;
  selectedTaskId: number | null;
  onSelectTask: ((taskId: number) => void) | null;
  onAddSubtask: ((parentTaskId: number, parentTitle: string) => void) | null;
}) {
  return templates.map((template) => {
    const runtime = runtimeForTemplate(template.id, stageId, subtasks, statusByTemplateId);
    if (runtime !== null && runtime.taskId !== null) {
      renderedTaskIds.add(runtime.taskId);
    }
    let addSubtaskHandler: (() => void) | null = null;
    if (runtime !== null && runtime.taskId !== null && onAddSubtask !== null) {
      const taskId = runtime.taskId;
      addSubtaskHandler = () => onAddSubtask(taskId, template.title);
    }
    return (
      <div key={template.id} className="flex flex-col gap-2">
        <ProgressTaskNode
          title={template.title}
          depth={depth}
          runtime={runtime}
          selected={runtime !== null && runtime.taskId === selectedTaskId}
          adHoc={null}
          onSelect={() => {
            if (runtime !== null && runtime.taskId !== null && onSelectTask !== null) {
              onSelectTask(runtime.taskId);
            }
          }}
          onAddSubtask={addSubtaskHandler}
        />
        {runtime !== null && runtime.taskId !== null ? (
          <ProgressChildTasks
            parentTaskId={runtime.taskId}
            depth={depth + 1}
            subtasks={subtasks}
            excludeTaskIds={excludeTaskIds}
            renderedTaskIds={renderedTaskIds}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onAddSubtask={onAddSubtask}
          />
        ) : null}
        {template.children.length > 0
          ? buildProgressTaskTree({
              templates: sanitizeStageTemplates(template.children),
              depth: depth + 1,
              stageId,
              subtasks,
              excludeTaskIds,
              renderedTaskIds,
              statusByTemplateId,
              selectedTaskId,
              onSelectTask,
              onAddSubtask,
            })
          : null}
      </div>
    );
  });
}

function renderSubtaskBranch(
  subtask: TaskSubtask,
  depth: number,
  subtasks: TaskSubtask[],
  templatePlacedTaskIds: Set<number>,
  renderedTaskIds: Set<number>,
  selectedTaskId: number | null,
  onSelectTask: ((taskId: number) => void) | null,
  onAddSubtask: ((parentTaskId: number, parentTitle: string) => void) | null,
  adHoc: boolean | null,
) {
  renderedTaskIds.add(subtask.taskId);
  const runtime = toRuntime(subtask);
  return (
    <div key={subtask.taskId} className="flex flex-col gap-2">
      <ProgressTaskNode
        title={subtask.title}
        depth={depth}
        runtime={runtime}
        selected={subtask.taskId === selectedTaskId}
        adHoc={adHoc}
        onSelect={() => {
          if (onSelectTask !== null) {
            onSelectTask(subtask.taskId);
          }
        }}
        onAddSubtask={
          onAddSubtask ? () => onAddSubtask(subtask.taskId, subtask.title) : null
        }
      />
      <ProgressChildTasks
        parentTaskId={subtask.taskId}
        depth={depth + 1}
        subtasks={subtasks}
        excludeTaskIds={templatePlacedTaskIds}
        renderedTaskIds={renderedTaskIds}
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
        onAddSubtask={onAddSubtask}
      />
    </div>
  );
}

function ProgressStageColumn({
  stage,
  flowIndex,
  phase,
  epicId,
  subtasks,
  workflowState,
  renderedTaskIds,
  selectedTaskId,
  onSelectTask,
  onAddTaskToStage,
  onAddSubtask,
}: {
  stage: DisplayStage;
  flowIndex: number;
  phase: StagePhase;
  epicId: number;
  subtasks: TaskSubtask[];
  workflowState: WorkflowStateNode[];
  renderedTaskIds: Set<number>;
  selectedTaskId: number | null;
  onSelectTask: ((taskId: number) => void) | null;
  onAddTaskToStage: (() => void) | null;
  onAddSubtask: ((parentTaskId: number, parentTitle: string) => void) | null;
}) {
  const templates = sanitizeStageTemplates(stage.taskTemplates);
  const statusByTemplateId = buildStatusLookup(subtasks, stage.id, workflowState);
  const templatePlacedTaskIds = collectTemplatePlacedTaskIds(
    templates,
    stage.id,
    subtasks,
    statusByTemplateId,
  );
  const epicRoots = epicRootSubtasksForStage(
    stage.id,
    subtasks,
    epicId,
    templatePlacedTaskIds,
    renderedTaskIds,
  );
  const stats = stageSubtaskStats(stage.id, subtasks);
  const columnWidth = (stage.columnWidth !== null ? stage.columnWidth : STAGE_CARD_WIDTH);
  const hasTemplates = templates.length > 0;
  const hasStageSubtasks = subtasks.some((entry) => entry.stageId === stage.id);
  const hasTasks = hasTemplates || epicRoots.length > 0 || hasStageSubtasks;
  const taskTreeNodes = hasTasks
    ? buildProgressTaskTree({
        templates,
        depth: 0,
        stageId: stage.id,
        subtasks,
        excludeTaskIds: templatePlacedTaskIds,
        renderedTaskIds,
        statusByTemplateId,
        selectedTaskId,
        onSelectTask,
        onAddSubtask,
      })
    : [];
  const unplacedSubtasks = hasTasks
    ? unplacedStageSubtasks(
        stage.id,
        subtasks,
        epicId,
        templatePlacedTaskIds,
        renderedTaskIds,
      )
    : [];
  const remainingSubtasks = hasTasks
    ? remainingStageSubtasks(stage.id, subtasks, renderedTaskIds, templatePlacedTaskIds)
    : [];
  const epicRootNodes = epicRoots.map((subtask) =>
    renderSubtaskBranch(
      subtask,
      0,
      subtasks,
      templatePlacedTaskIds,
      renderedTaskIds,
      selectedTaskId,
      onSelectTask,
      onAddSubtask,
      !subtask.templateId,
    ),
  );
  const unplacedNodes = unplacedSubtasks.map((subtask) =>
    renderSubtaskBranch(
      subtask,
      subtask.parentId === epicId ? 0 : 1,
      subtasks,
      templatePlacedTaskIds,
      renderedTaskIds,
      selectedTaskId,
      onSelectTask,
      onAddSubtask,
      !subtask.templateId,
    ),
  );
  const remainingNodes = remainingSubtasks.map((subtask) =>
    renderSubtaskBranch(
      subtask,
      subtask.parentId === epicId ? 0 : 1,
      subtasks,
      templatePlacedTaskIds,
      renderedTaskIds,
      selectedTaskId,
      onSelectTask,
      onAddSubtask,
      !subtask.templateId,
    ),
  );

  return (
    <div
      className="pointer-events-none absolute flex flex-col items-start"
      style={{ left: stage.displayX, top: stage.displayY, width: columnWidth }}
    >
      <div className="relative z-10 shrink-0" style={{ width: STAGE_CARD_WIDTH }}>
        <ProgressStageCard stage={stage} flowIndex={flowIndex} phase={phase} stats={stats} />
        {onAddTaskToStage ? (
          <div className="pointer-events-auto flex flex-col items-center">
            <NodeLink className="h-4 w-px" />
            <NodeAddButton title="Add task to this step" dataEpicAdd="true" onClick={onAddTaskToStage} className={null} disabled={null} style={null} dataNodeInsert={null} dataStageInsert={null} />
          </div>
        ) : null}
      </div>
      {hasTasks ? (
        <div
          className="pointer-events-auto relative z-20 flex w-full flex-col gap-2"
          style={{ marginTop: STEP_TASK_GAP }}
        >
          {taskTreeNodes}
          {epicRootNodes}
          {unplacedNodes}
          {remainingNodes}
        </div>
      ) : null}
    </div>
  );
}

export function EpicProgressCanvas(props: EpicProgressCanvasProps) {
  const {
    stages,
    epicId,
    epicStageId,
    subtasks,
    selectedTaskId,
    onSelectTask,
    onAddTaskToStage,
    onAddSubtask,
    className,
  } = props;
  let workflowState: WorkflowStateNode[] = [];
  if (props.workflowState !== null) {
    workflowState = props.workflowState;
  }
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<Point>({ x: 48, y: 48 });
  const zoomRef = useRef(0.85);
  const [pan, setPan] = useState<Point>({ x: 48, y: 48 });
  const [zoom, setZoom] = useState(0.85);
  const [panDrag, setPanDrag] = useState<PanDragState | null>(null);

  panRef.current = pan;
  zoomRef.current = zoom;

  const sortedStages = useMemo(
    () => stages.slice().sort((a, b) => a.position - b.position),
    [stages],
  );
  const displayStages = useMemo(() => stagesForDisplay(stages), [stages]);
  const layoutKey = useMemo(() => stageLayoutKey(stages), [stages]);
  const canvasSubtasks = useMemo(
    () => prepareCanvasSubtasks(stages, epicStageId, subtasks, epicId),
    [stages, epicStageId, subtasks, epicId],
  );
  const renderedTaskIds = new Set<number>();

  const connectors = useMemo(() => {
    const paths: string[] = [];
    for (let index = 0; index < displayStages.length - 1; index += 1) {
      const from = displayStages[index];
      const to = displayStages[index + 1];
      if (from && to) paths.push(connectorPath(from, to));
    }
    return paths;
  }, [displayStages]);

  const fitView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || displayStages.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stage of displayStages) {
      minX = Math.min(minX, stage.displayX);
      minY = Math.min(minY, stage.displayY);
      maxX = Math.max(maxX, stage.displayX + stage.columnWidth);
      maxY = Math.max(maxY, stage.displayY + stageStackHeight(stage));
    }

    const padding = 80;
    const boundsW = maxX - minX + padding * 2;
    const boundsH = maxY - minY + padding * 2;
    const nextZoom = clamp(
      Math.min(viewport.clientWidth / boundsW, viewport.clientHeight / boundsH),
      MIN_ZOOM,
      1,
    );
    const contentW = boundsW * nextZoom;
    const contentH = boundsH * nextZoom;
    setZoom(nextZoom);
    setPan({
      x: (viewport.clientWidth - contentW) / 2 - (minX - padding) * nextZoom,
      y: (viewport.clientHeight - contentH) / 2 - (minY - padding) * nextZoom,
    });
  }, [displayStages]);

  useEffect(() => {
    if (displayStages.length > 0) fitView();
  }, [layoutKey, displayStages.length, fitView]);

  useEffect(() => {
    if (!panDrag) return;
    const active = panDrag;
    return bindPanDrag(
      (event) => {
        setPan({
          x: active.panX + (event.clientX - active.startX),
          y: active.panY + (event.clientY - active.startY),
        });
      },
      () => {
        setPanDrag(null);
      },
    );
  }, [panDrag]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    return bindCanvasWheelZoom(
      el,
      {
        getZoom: () => zoomRef.current,
        getPan: () => panRef.current,
        setZoom,
        setPan,
      },
      MIN_ZOOM,
      MAX_ZOOM,
    );
  }, []);

  const templateCount = useMemo(
    () =>
      sortedStages.reduce(
        (sum, stage) => sum + flattenTemplates(stage.taskTemplates).length,
        0,
      ),
    [sortedStages],
  );

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col bg-[#080808]", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-foreground">
            Click a task for the panel · Drag to pan · Ctrl+scroll to zoom
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Done
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-400" /> In progress
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-zinc-400" /> Todo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Selected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-dashed border-white/30" /> Pending
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => clamp(z * 0.9, MIN_ZOOM, MAX_ZOOM))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => clamp(z * 1.1, MIN_ZOOM, MAX_ZOOM))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => fitView()}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-[420px] flex-1 cursor-grab select-none overflow-hidden active:cursor-grabbing"
        onPointerDown={(event) => {
          if (event.button !== 0 && event.button !== 1) return;
          if ((event.target as HTMLElement).closest("[data-epic-task]")) return;
          beginPanPointer(event);
          setPanDrag({
            startX: event.clientX,
            startY: event.clientY,
            panX: pan.x,
            panY: pan.y,
          });
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
          }}
        >
          {displayStages.map((stage, flowIndex) => (
            <ProgressStageColumn
              key={stage.id}
              stage={stage}
              flowIndex={flowIndex}
              phase={resolveStagePhase(stage, epicStageId, sortedStages)}
              epicId={epicId}
              subtasks={canvasSubtasks}
              workflowState={workflowState}
              renderedTaskIds={renderedTaskIds}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              onAddTaskToStage={
                onAddTaskToStage ? () => onAddTaskToStage(stage.id, stage.title) : null
              }
              onAddSubtask={
                onAddSubtask
                  ? (parentTaskId, parentTitle) => onAddSubtask(parentTaskId, parentTitle, stage.id)
                  : null
              }
            />
          ))}

          <svg
            className="pointer-events-none absolute inset-0 z-[5]"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            aria-hidden
          >
            {connectors.map((path, index) => (
              <path
                key={`connector-${index}`}
                d={path}
                fill="none"
                stroke="rgba(96,165,250,0.35)"
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>
      </div>

      {templateCount === 0 ? (
        <p className="border-t border-white/[0.06] px-4 py-3 text-xs text-muted-foreground">
          No pipeline template configured. Set up tasks on the Pipeline page first.
        </p>
      ) : null}
    </div>
  );
}
