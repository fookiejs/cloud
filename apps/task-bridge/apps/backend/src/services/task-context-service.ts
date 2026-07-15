import {
  canonicalDescription,
  resolveEpicId,
  type BridgeTask,
} from "../domain/task.js";
import { resolveWorkStatus } from "../domain/work-status.js";
import {
  addBridgeTaskAgentComment,
  getBridgeTask,
  listBridgeTasks,
  releaseBridgeTask,
  updateBridgeTaskAgentMetadata,
  updateBridgeTaskBrief,
} from "./task-service.js";
import {
  syncEpicStage,
  updateTaskWorkStatus,
} from "./epic-service.js";
import { getStageTitleLookup } from "./workflow-service.js";
import { listWorkflowStateSummaries } from "./workflow-state-service.js";

export type TaskContextPayload = {
  taskId: number;
  title: string;
  description: string;
  brief: string;
  agentMetadata: BridgeTask["agentMetadata"];
  comments: BridgeTask["comments"];
  workStatus: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  stageId: string | null;
  stageTitle: string | null;
  projectId: string;
  projectName: string;
  parentId: number | null;
  epicId: number | null;
  epic: {
    taskId: number;
    title: string;
    description: string;
    stageId: string | null;
    stageTitle: string | null;
  } | null;
  parent: {
    taskId: number;
    title: string;
    description: string;
  } | null;
  workflowState: ReturnType<typeof listWorkflowStateSummaries>;
};

function resolveStageTitle(
  stageId: string | null,
  titles: Map<string, string>,
): string | null {
  if (stageId === null) return null;
  const title = titles.get(stageId);
  if (title) return title;
  return stageId;
}

export function buildTaskContext(task: BridgeTask): TaskContextPayload {
  const allTasks = listBridgeTasks();
  const stageTitles = getStageTitleLookup(task.projectId);

  let epicPayload: TaskContextPayload["epic"] = null;
  const epicId = task.epicId ?? resolveEpicId(allTasks, task);
  if (epicId !== null) {
    const epic = getBridgeTask(epicId);
    if (epic) {
      syncEpicStage(epic.id);
      const refreshed = getBridgeTask(epic.id) ?? epic;
      epicPayload = {
        taskId: refreshed.id,
        title: refreshed.title,
        description: canonicalDescription(refreshed),
        stageId: refreshed.stageId,
        stageTitle: resolveStageTitle(refreshed.stageId, stageTitles),
      };
    }
  }

  let parentPayload: TaskContextPayload["parent"] = null;
  if (task.parentId !== null) {
    const parent = getBridgeTask(task.parentId);
    if (parent) {
      parentPayload = {
        taskId: parent.id,
        title: parent.title,
        description: canonicalDescription(parent),
      };
    }
  }

  let workStatus: string | null = null;
  if (task.parentId !== null) {
    workStatus = resolveWorkStatus(task);
  }

  let workflowState: ReturnType<typeof listWorkflowStateSummaries> = [];
  if (epicId !== null) {
    workflowState = listWorkflowStateSummaries(epicId);
  }

  return {
    taskId: task.id,
    title: task.title,
    description: canonicalDescription(task),
    brief: task.brief,
    agentMetadata: task.agentMetadata,
    comments: task.comments,
    workStatus,
    claimedBy: task.claimedBy,
    claimedAt: task.claimedAt,
    stageId: task.stageId,
    stageTitle: resolveStageTitle(task.stageId, stageTitles),
    projectId: task.projectId,
    projectName: task.projectName,
    parentId: task.parentId,
    epicId,
    epic: epicPayload,
    parent: parentPayload,
    workflowState,
  };
}

export type CompleteTaskResult = {
  task: TaskContextPayload;
  epicStageId: string | null;
  epicStageTitle: string | null;
};

export function completeBridgeTask(
  taskId: number,
  input: {
    by: string;
    summary: string | null;
    prUrl: string | null;
  },
): CompleteTaskResult | null {
  const existing = getBridgeTask(taskId);
  if (!existing || existing.parentId === null) {
    return null;
  }

  const updated = updateTaskWorkStatus(taskId, "done", input.by);
  if (!updated) return null;

  if (input.summary !== null && input.summary.trim().length > 0) {
    addBridgeTaskAgentComment(taskId, input.by, input.summary.trim(), ["completion"]);
    updateBridgeTaskBrief(taskId, { brief: null, append: input.summary.trim(), by: input.by });
  }

  if (input.prUrl !== null && input.prUrl.trim().length > 0) {
    const url = input.prUrl.trim();
    updateBridgeTaskAgentMetadata(taskId, { prUrl: url });
    updateBridgeTaskBrief(taskId, {
      brief: null,
      append: `PR: ${url}`,
      by: input.by,
    });
  }

  if (updated.claimedBy !== null) {
    releaseBridgeTask(taskId);
  }

  const finalTask = getBridgeTask(taskId);
  if (!finalTask) return null;

  const epicId = finalTask.epicId ?? resolveEpicId(listBridgeTasks(), finalTask);
  let epicStageId: string | null = null;
  let epicStageTitle: string | null = null;
  if (epicId !== null) {
    syncEpicStage(epicId);
    const epic = getBridgeTask(epicId);
    if (epic) {
      epicStageId = epic.stageId;
      const titles = getStageTitleLookup(epic.projectId);
      epicStageTitle = resolveStageTitle(epic.stageId, titles);
    }
  }

  return {
    task: buildTaskContext(finalTask),
    epicStageId,
    epicStageTitle,
  };
}
