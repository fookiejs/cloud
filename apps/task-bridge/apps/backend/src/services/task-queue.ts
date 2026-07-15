import type { BridgeTask, TaskComment } from "../domain/task.js";
import { canonicalDescription, isTaskClaimed } from "../domain/task.js";
import { resolveWorkStatus, type WorkStatus } from "../domain/work-status.js";
import {
  buildEpicClaimIndex,
  canActorClaimTask,
  type ClaimActor,
  isWorkflowClaimable,
  normalizeClaimActor,
  sortWorkflowClaimCandidates,
  userAwaitingReply,
  workflowClaimBlockReason,
} from "./task-claim-policy.js";
import { buildTaskContext, type TaskContextPayload } from "./task-context-service.js";
import { claimBridgeTask, listBridgeTasks } from "./task-service.js";

export { userAwaitingReply } from "./task-claim-policy.js";

export function turnIdForTask(task: BridgeTask): string {
  if (userAwaitingReply(task)) {
    for (let index = task.comments.length - 1; index >= 0; index -= 1) {
      const comment = task.comments[index];
      if (!comment) {
        continue;
      }
      if (comment.role === "user") return `user-${comment.id}`;
    }
  }
  if (isTaskClaimed(task) && task.claimedAt) return `claimed-${task.claimedAt}`;
  return `create-${task.createdAt}`;
}

export type TaskClaimPayload = {
  taskId: number;
  turnId: string;
  projectId: string;
  projectName: string;
  parentId: number | null;
  epicId: number | null;
  title: string;
  description: string;
  stageId: string | null;
  workStatus: WorkStatus | null;
  createdAt: string;
  comments: TaskComment[];
  brief: string;
  agentMetadata: BridgeTask["agentMetadata"];
  context: TaskContextPayload;
};

function buildClaimPayload(task: BridgeTask, turnId: string): TaskClaimPayload {
  let workStatus: WorkStatus | null;
  if (task.parentId !== null) {
    workStatus = resolveWorkStatus(task);
  } else {
    workStatus = null;
  }
  return {
    taskId: task.id,
    turnId,
    projectId: task.projectId,
    projectName: task.projectName,
    parentId: task.parentId,
    epicId: task.epicId,
    title: task.title,
    description: canonicalDescription(task),
    stageId: task.stageId,
    workStatus,
    createdAt: task.createdAt,
    comments: task.comments,
    brief: task.brief,
    agentMetadata: task.agentMetadata,
    context: buildTaskContext(task),
  };
}

function scopeTasks(tasks: BridgeTask[], projectId: string | null): BridgeTask[] {
  if (!projectId) return tasks;
  return tasks.filter((task) => task.projectId === projectId);
}

export function listPendingTasks(
  projectId: string | null = null,
  rawActor: ClaimActor | null = null,
): TaskClaimPayload[] {
  let actor: ClaimActor | null;
  if (rawActor !== null) {
    actor = normalizeClaimActor(rawActor);
  } else {
    actor = null;
  }
  const tasks = scopeTasks(listBridgeTasks(), projectId);
  const index = buildEpicClaimIndex(tasks);
  return sortWorkflowClaimCandidates(
    tasks.filter((task) => isWorkflowClaimable(task, index, actor)),
    index,
  ).map((task) => buildClaimPayload(task, turnIdForTask(task)));
}

export function claimNextTask(
  rawActor: ClaimActor,
  options: { projectId: string | null } | null = null,
): { task: BridgeTask; item: TaskClaimPayload } | null {
  const actor = normalizeClaimActor(rawActor);
  let projectId: string | null;
  if (options !== null) {
    projectId = options.projectId;
  } else {
    projectId = null;
  }
  const tasks = scopeTasks(listBridgeTasks(), projectId);
  const index = buildEpicClaimIndex(tasks);
  const candidates = sortWorkflowClaimCandidates(
    tasks.filter((task) => canActorClaimTask(task, index, actor)),
    index,
  );

  for (const candidate of candidates) {
    const claimed = claimBridgeTask(candidate.id, actor.claimedBy);
    if (!claimed) continue;
    return {
      task: claimed,
      item: buildClaimPayload(claimed, turnIdForTask(claimed)),
    };
  }

  return null;
}

export function validateTaskClaim(
  taskId: number,
  rawActor: ClaimActor,
): string | null {
  const actor = normalizeClaimActor(rawActor);
  const tasks = listBridgeTasks();
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) return "Task not found";
  const index = buildEpicClaimIndex(tasks);
  if (canActorClaimTask(task, index, actor)) return null;
  if (isTaskClaimed(task) && !userAwaitingReply(task)) return "Task is already claimed";
  return workflowClaimBlockReason(task, index, actor);
}
