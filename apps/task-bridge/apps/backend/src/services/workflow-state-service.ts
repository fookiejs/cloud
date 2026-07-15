import type { BridgeTask } from "../domain/task.js";
import type { WorkStatus } from "../domain/work-status.js";
import {
  buildInitialWorkflowState,
  summarizeWorkflowStateNodes,
  type EpicWorkflowStateData,
  type WorkflowStateNodeSummary,
} from "../domain/workflow-state.js";
import {
  getEpicWorkflowStateData,
  insertEpicRow,
  insertWorkflowStateRow,
  mutateEpicWorkflowState,
  saveEpicWorkflowStateData,
  updateEpicStageRow,
} from "../db/epic-workflow-db.js";
import { listWorkflowStageRows } from "../db/workflow-db.js";
import { resolveWorkStatus } from "../domain/work-status.js";

export function rebuildEpicWorkflowState(
  epicId: number,
  projectId: string,
  stageId: string | null,
): EpicWorkflowStateData {
  const stageRows = listWorkflowStageRows({ projectId, stageId: "" });
  const initial = buildInitialWorkflowState({
    stageId,
    stages: stageRows.map((row) => ({
      id: row.id,
      taskTemplatesJson: row.task_templates_json,
      title: row.title,
    })),
  });
  updateEpicStageRow(epicId, stageId);
  return saveEpicWorkflowStateData(epicId, initial);
}

export function rollbackEpicWorkflowFromStage(
  epicId: number,
  sourceStageId: string,
  projectId: string,
): void {
  const stageRows = listWorkflowStageRows({ projectId, stageId: "" });
  const ordered = stageRows.slice().sort((a, b) => a.position - b.position);
  const stageIndex = ordered.findIndex((row) => row.id === sourceStageId);
  let laterStageIds: Set<string>;
  if (stageIndex < 0) {
    laterStageIds = new Set<string>();
  } else {
    laterStageIds = new Set(ordered.slice(stageIndex + 1).map((row) => row.id));
  }

  updateEpicStageRow(epicId, sourceStageId);
  mutateEpicWorkflowState(epicId, (data) => {
    data.stageId = sourceStageId;
    for (const node of Object.values(data.nodes)) {
      if (!laterStageIds.has(node.stageId)) continue;
      node.taskId = null;
      node.workStatus = "todo";
      node.comments = [];
    }
  });
}

export function resetWorkflowStateNodesForTasks(epicId: number, taskIds: Set<number>): void {
  if (taskIds.size === 0) return;
  mutateEpicWorkflowState(epicId, (data) => {
    for (const node of Object.values(data.nodes)) {
      if (node.taskId !== null && taskIds.has(node.taskId)) {
        node.workStatus = "todo";
      }
    }
  });
}

export function createEpicRecords(input: {
  id: number;
  projectId: string;
  title: string;
  description: string;
  stageId: string | null;
  createdBy: string;
}): EpicWorkflowStateData {
  insertEpicRow({
    id: input.id,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    stageId: input.stageId,
    createdBy: input.createdBy,
  });
  const stageRows = listWorkflowStageRows({ projectId: input.projectId, stageId: "" });
  const initial = buildInitialWorkflowState({
    stageId: input.stageId,
    stages: stageRows.map((row) => ({
      id: row.id,
      taskTemplatesJson: row.task_templates_json,
      title: row.title,
    })),
  });
  insertWorkflowStateRow(input.id, initial);
  return initial;
}

export function loadEpicWorkflowState(epicId: number): EpicWorkflowStateData | null {
  return getEpicWorkflowStateData(epicId);
}

export function syncEpicWorkflowStage(epicId: number, stageId: string | null): void {
  updateEpicStageRow(epicId, stageId);
  mutateEpicWorkflowState(epicId, (data) => {
    data.stageId = stageId;
  });
}

export function linkSpawnedTemplateTask(
  epicId: number,
  templateId: string,
  taskId: number,
): void {
  mutateEpicWorkflowState(epicId, (data) => {
    const node = data.nodes[templateId];
    if (!node) return;
    node.taskId = taskId;
  });
}

export function syncTaskIntoWorkflowState(task: BridgeTask): void {
  const epicId = task.epicId;
  const templateId = task.templateId;
  if (epicId === null || templateId === null) return;
  mutateEpicWorkflowState(epicId, (data) => {
    const node = data.nodes[templateId];
    if (!node) return;
    node.taskId = task.id;
    node.workStatus = resolveWorkStatus(task);
    node.comments = task.comments.slice();
    node.title = task.title;
    node.description = task.description;
  });
}

export function readWorkflowStateNode(
  epicId: number,
  templateId: string,
): EpicWorkflowStateData["nodes"][string] | null {
  const data = getEpicWorkflowStateData(epicId);
  if (!data) return null;
  const node = data.nodes[templateId];
  if (node) {
    return node;
  }
  return null;
}

export function patchWorkflowStateNode(
  epicId: number,
  templateId: string,
  patch: {
    workStatus: WorkStatus | null;
    comments: BridgeTask["comments"] | null;
    taskId: number | null;
  },
  apply: {
    workStatus: boolean;
    comments: boolean;
    taskId: boolean;
  },
): void {
  mutateEpicWorkflowState(epicId, (data) => {
    const node = data.nodes[templateId];
    if (!node) return;
    if (apply.workStatus && patch.workStatus !== null) {
      node.workStatus = patch.workStatus;
    }
    if (apply.comments && patch.comments !== null) {
      node.comments = patch.comments.slice();
    }
    if (apply.taskId) {
      node.taskId = patch.taskId;
    }
  });
}

export function listWorkflowStateSummaries(epicId: number): WorkflowStateNodeSummary[] {
  const data = getEpicWorkflowStateData(epicId);
  if (!data) return [];
  return summarizeWorkflowStateNodes(data);
}

export function spawnContextFromWorkflowState(data: EpicWorkflowStateData): {
  spawnedTemplateIds: Set<string>;
  doneTemplateIds: Set<string>;
} {
  const spawnedTemplateIds = new Set<string>();
  const doneTemplateIds = new Set<string>();
  for (const node of Object.values(data.nodes)) {
    if (node.taskId !== null) spawnedTemplateIds.add(node.templateId);
    if (node.workStatus === "done") doneTemplateIds.add(node.templateId);
  }
  return { spawnedTemplateIds, doneTemplateIds };
}

export function applyWorkflowStateNodeToTaskInput(
  epicId: number,
  templateId: string,
  defaults: { workStatus: WorkStatus; comments: BridgeTask["comments"] },
): { workStatus: WorkStatus; comments: BridgeTask["comments"] } {
  const node = readWorkflowStateNode(epicId, templateId);
  if (!node) return defaults;
  return {
    workStatus: node.workStatus,
    comments: node.comments.slice(),
  };
}
