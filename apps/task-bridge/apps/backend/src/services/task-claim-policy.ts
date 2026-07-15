import {
  listWorkflowStageRows,
} from "../db/workflow-db.js";
import { flattenTemplateNodes } from "../domain/task-template-graph.js";
import { findProjectMember } from "../domain/project-member.js";
import type { BridgeTask, TaskComment } from "../domain/task.js";
import { isWorkDone, resolveWorkStatus, type WorkStatus } from "../domain/work-status.js";
import { listEpicWorkflowTasks } from "../domain/task.js";
import { resolveStageTaskTemplates } from "../domain/workflow-stage.js";
import { emptyToNull } from "../lib/strings.js";
import { computeEpicStageId } from "./epic-service.js";

export type ClaimActor = {
  claimedBy: string;
  role: string;
};

export function resolveClaimActor(projectId: string, memberName: string): ClaimActor | null {
  const member = findProjectMember(projectId, memberName);
  if (!member) return null;
  return {
    claimedBy: member.name,
    role: member.role,
  };
}

export function normalizeClaimActor(actor: ClaimActor): ClaimActor {
  return {
    claimedBy: actor.claimedBy,
    role: actor.role,
  };
}

function latestCommentByRole(
  comments: TaskComment[],
  role: TaskComment["role"],
): TaskComment | null {
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const entry = comments[index];
    if (!entry) continue;
    if (entry.role === role) return entry;
  }
  return null;
}

export function userAwaitingReply(task: BridgeTask): boolean {
  const lastUser = latestCommentByRole(task.comments, "user");
  if (!lastUser) return false;
  const lastSystem = latestCommentByRole(task.comments, "system");
  if (!lastSystem) return true;

  const humanAt = Date.parse(lastUser.at);
  const systemAt = Date.parse(lastSystem.at);
  if (Number.isNaN(humanAt) || Number.isNaN(systemAt)) return true;
  return humanAt > systemAt;
}

export function rolesMatch(actorRole: string, requiredRole: string | null): boolean {
  if (requiredRole === null || requiredRole.length === 0) {
    return true;
  }
  return actorRole.trim().toLowerCase() === requiredRole.trim().toLowerCase();
}

export function resolveTaskClaimRole(task: BridgeTask): string | null {
  if (task.parentId === null) return null;

  if (task.assigneeRole) return task.assigneeRole;

  if (task.templateId) {
    for (const row of listWorkflowStageRows({ projectId: task.projectId, stageId: "" })) {
      const roots = resolveStageTaskTemplates({
        taskTemplatesJson: row.task_templates_json,
        stageId: row.id,
        stageTitle: row.title,
      });
      for (const node of flattenTemplateNodes(roots)) {
        if (node.id === task.templateId && node.assigneeRole) {
          return node.assigneeRole;
        }
      }
    }
  }

  if (task.assignee !== null) {
    const member = findProjectMember(task.projectId, task.assignee);
    if (member !== null) return member.role;
  }

  if (task.stageId !== null) {
    const stageRows = listWorkflowStageRows({
      projectId: task.projectId,
      stageId: task.stageId,
    });
    if (stageRows.length > 0) {
      const stageRow = stageRows[0];
      if (!stageRow) return null;
      const autoRole = emptyToNull(stageRow.auto_assign_role);
      if (autoRole) return autoRole;
    }
  }

  return null;
}

export type EpicClaimIndex = {
  activeStageByEpic: Map<number, string | null>;
  stagePositionByProject: Map<string, Map<string, number>>;
};

export function buildEpicClaimIndex(tasks: BridgeTask[]): EpicClaimIndex {
  const activeStageByEpic = new Map<number, string | null>();
  const stagePositionByProject = new Map<string, Map<string, number>>();
  const epics = tasks.filter((task) => task.parentId === null);

  for (const epic of epics) {
    if (!stagePositionByProject.has(epic.projectId)) {
      const positions = new Map<string, number>();
      for (const row of listWorkflowStageRows({ projectId: epic.projectId, stageId: "" }).sort(
        (a, b) => a.position - b.position,
      )) {
        positions.set(row.id, row.position);
      }
      stagePositionByProject.set(epic.projectId, positions);
    }
    const stageRows = listWorkflowStageRows({ projectId: epic.projectId, stageId: "" }).sort(
      (a, b) => a.position - b.position,
    );
    const subtasks = listEpicWorkflowTasks(tasks, epic.id);
    activeStageByEpic.set(epic.id, computeEpicStageId(stageRows, subtasks));
  }

  return { activeStageByEpic, stagePositionByProject };
}

export function isTaskOnEpicActiveStage(task: BridgeTask, index: EpicClaimIndex): boolean {
  if (!task.stageId) return false;
  let epicId: number | null;
  if (task.epicId !== null) {
    epicId = task.epicId;
  } else {
    epicId = task.parentId;
  }
  if (!epicId) return false;
  const activeStageId = index.activeStageByEpic.get(epicId);
  return activeStageId === task.stageId;
}

export function passesWorkflowClaimGate(task: BridgeTask, index: EpicClaimIndex): boolean {
  if (task.parentId === null) return false;
  if (isWorkDone(task)) return false;
  return isTaskOnEpicActiveStage(task, index);
}

export function canActorClaimTask(
  task: BridgeTask,
  index: EpicClaimIndex,
  actor: ClaimActor,
): boolean {
  if (task.parentId === null || isWorkDone(task)) return false;

  if (userAwaitingReply(task)) {
    return true;
  }

  if (task.claimedBy) return false;
  if (!passesWorkflowClaimGate(task, index)) return false;
  const requiredRole = resolveTaskClaimRole(task);
  return rolesMatch(actor.role, requiredRole);
}

export function canActorUpdateWorkStatus(
  task: BridgeTask,
  index: EpicClaimIndex,
  _actor: ClaimActor | null = null,
): boolean {
  if (task.parentId === null || isWorkDone(task)) return false;
  if (!isTaskOnEpicActiveStage(task, index)) return false;
  return true;
}

export function workflowUpdateBlockReason(
  task: BridgeTask,
  index: EpicClaimIndex,
  nextWorkStatus: WorkStatus | null = null,
): string | null {
  if (task.parentId === null) return "Epics cannot be updated";
  const isReopen =
    isWorkDone(task) &&
    nextWorkStatus !== null &&
    (nextWorkStatus === "todo" || nextWorkStatus === "in_progress");
  if (isWorkDone(task) && !isReopen) {
    return "Task is already done";
  }
  if (!isReopen && !isTaskOnEpicActiveStage(task, index)) {
    return "Task is not on the active pipeline step";
  }
  return null;
}

export function isWorkflowClaimable(
  task: BridgeTask,
  index: EpicClaimIndex,
  actor: ClaimActor | null,
): boolean {
  if (actor === null) {
    if (userAwaitingReply(task)) return task.parentId !== null && !isWorkDone(task);
    if (task.claimedBy) return false;
    return passesWorkflowClaimGate(task, index);
  }
  return canActorClaimTask(task, index, actor);
}

function activeStageSortKey(task: BridgeTask, index: EpicClaimIndex): number {
  if (!task.parentId) return Number.MAX_SAFE_INTEGER;
  const positions = index.stagePositionByProject.get(task.projectId);
  const activeStageId = index.activeStageByEpic.get(task.parentId);
  if (!positions || !activeStageId) return Number.MAX_SAFE_INTEGER;
  if (!positions.has(activeStageId)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return positions.get(activeStageId) as number;
}

function workStatusSortKey(task: BridgeTask): number {
  const status = resolveWorkStatus(task);
  if (status === "in_progress") return 0;
  if (status === "todo") return 1;
  return 2;
}

export function compareWorkflowClaimPriority(
  a: BridgeTask,
  b: BridgeTask,
  index: EpicClaimIndex,
): number {
  let awaitingA: number;
  if (userAwaitingReply(a)) {
    awaitingA = 0;
  } else {
    awaitingA = 1;
  }
  let awaitingB: number;
  if (userAwaitingReply(b)) {
    awaitingB = 0;
  } else {
    awaitingB = 1;
  }
  if (awaitingA !== awaitingB) return awaitingA - awaitingB;

  const stageA = activeStageSortKey(a, index);
  const stageB = activeStageSortKey(b, index);
  if (stageA !== stageB) return stageA - stageB;

  let epicAId: number | null;
  if (a.epicId !== null) {
    epicAId = a.epicId;
  } else {
    epicAId = a.parentId;
  }
  let epicBId: number | null;
  if (b.epicId !== null) {
    epicBId = b.epicId;
  } else {
    epicBId = b.parentId;
  }
  let epicA: number;
  if (epicAId !== null) {
    epicA = epicAId;
  } else {
    epicA = Number.MAX_SAFE_INTEGER;
  }
  let epicB: number;
  if (epicBId !== null) {
    epicB = epicBId;
  } else {
    epicB = Number.MAX_SAFE_INTEGER;
  }
  if (epicA !== epicB) return epicA - epicB;

  const workA = workStatusSortKey(a);
  const workB = workStatusSortKey(b);
  if (workA !== workB) return workA - workB;

  const createdA = Date.parse(a.createdAt);
  const createdB = Date.parse(b.createdAt);
  if (!Number.isNaN(createdA) && !Number.isNaN(createdB) && createdA !== createdB) {
    return createdA - createdB;
  }

  return a.id - b.id;
}

export function sortWorkflowClaimCandidates(
  tasks: BridgeTask[],
  index: EpicClaimIndex,
): BridgeTask[] {
  return tasks.slice().sort((a, b) => compareWorkflowClaimPriority(a, b, index));
}

export function workflowClaimBlockReason(
  task: BridgeTask,
  index: EpicClaimIndex,
  actor: ClaimActor | null,
): string | null {
  if (task.parentId === null) return "Epics cannot be claimed";
  if (isWorkDone(task)) return "Task is already done";

  if (actor !== null) {
    if (!userAwaitingReply(task)) {
      if (task.claimedBy) return "Task is already claimed";
      if (!isTaskOnEpicActiveStage(task, index)) {
        let epicId: number | null;
        if (task.epicId !== null) {
          epicId = task.epicId;
        } else {
          epicId = task.parentId;
        }
        let activeStageId: string | null = null;
        if (epicId !== null) {
          if (index.activeStageByEpic.has(epicId)) {
            activeStageId = index.activeStageByEpic.get(epicId) as string;
          }
        }
        if (!activeStageId) return "Epic has no active pipeline step";
        return `Task is on a later pipeline step; epic is at "${activeStageId}"`;
      }
      const requiredRole = resolveTaskClaimRole(task);
      if (!rolesMatch(actor.role, requiredRole)) {
        return "Role does not match task assignment";
      }
    }
    return null;
  }

  if (!isTaskOnEpicActiveStage(task, index)) {
    let epicId: number | null;
    if (task.epicId !== null) {
      epicId = task.epicId;
    } else {
      epicId = task.parentId;
    }
    let activeStageId: string | null = null;
    if (epicId !== null) {
      if (index.activeStageByEpic.has(epicId)) {
        activeStageId = index.activeStageByEpic.get(epicId) as string;
      }
    }
    if (!activeStageId) return "Epic has no active pipeline step";
    return `Task is on a later pipeline step; epic is at "${activeStageId}"`;
  }
  return null;
}
