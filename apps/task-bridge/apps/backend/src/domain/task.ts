import { AppError } from "../errors/app-error.js";
import { isWorkDone, type WorkStatus } from "./work-status.js";

export const DONE_STAGE_ID = "done";

export type TaskEventType =
  | "created"
  | "claimed"
  | "answered"
  | "done"
  | "commented"
  | "stage_changed"
  | "spec_updated";

export type TaskEvent = {
  type: TaskEventType;
  at: string;
  by: string;
  note: string | null;
};

export type AssigneeKind = "ai" | "";

export type CommentMetadata = Record<string, string | number | boolean | null>;

export type AgentMetadata = {
  lotaruRefs?: string[];
  prUrl?: string | null;
};

export type TaskComment = {
  id: string;
  role: "user" | "system";
  authorId: string;
  tags: string[];
  body: string;
  at: string;
  metadata: CommentMetadata | null;
};

export type BridgeTask = {
  id: number;
  projectId: string;
  projectName: string;
  parentId: number | null;
  epicId: number | null;
  templateId: string | null;
  title: string;
  description: string;
  acceptanceCriteria: string | null;
  priority: string | null;
  labels: string[];
  assignee: string;
  assigneeRole: string | null;
  assigneeKind: AssigneeKind | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  claimedBy: string | null;
  claimedAt: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  answer: string | null;
  stageId: string | null;
  workStatus: WorkStatus | null;
  brief: string;
  agentMetadata: AgentMetadata;
  comments: TaskComment[];
  events: TaskEvent[];
};

export function isDoneStage(stageId: string | null): boolean {
  return stageId === DONE_STAGE_ID;
}

export function isTaskClaimed(task: BridgeTask): boolean {
  return task.claimedBy !== null && task.claimedBy !== "";
}

export function touchTask(task: BridgeTask): void {
  task.updatedAt = new Date().toISOString();
}

export function sortTasks(tasks: BridgeTask[]): BridgeTask[] {
  return tasks.slice().sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt);
    const bTime = Date.parse(b.updatedAt || b.createdAt);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    return b.id - a.id;
  });
}

export function listSubtasks(
  tasks: BridgeTask[],
  parentId: number,
): BridgeTask[] {
  return sortTasks(tasks.filter((task) => task.parentId === parentId));
}

export function listDescendantIds(
  tasks: BridgeTask[],
  parentId: number,
): number[] {
  const ids: number[] = [];
  for (const child of listSubtasks(tasks, parentId)) {
    ids.push(child.id);
    for (const descendantId of listDescendantIds(tasks, child.id)) {
      ids.push(descendantId);
    }
  }
  return ids;
}

export function listEpicWorkflowTasks(
  tasks: BridgeTask[],
  epicId: number,
): BridgeTask[] {
  return sortTasks(
    tasks.filter((task) => {
      const resolved = task.epicId || resolveEpicId(tasks, task);
      return resolved === epicId;
    }),
  );
}

export function resolveTaskStageId(
  tasks: BridgeTask[],
  task: BridgeTask,
): string | null {
  if (task.stageId) return task.stageId;
  if (!task.parentId) return null;
  const parent = tasks.find((entry) => entry.id === task.parentId);
  if (!parent) return null;
  return resolveTaskStageId(tasks, parent);
}

export function resolveEpicId(
  tasks: BridgeTask[],
  task: BridgeTask,
): number | null {
  if (task.epicId !== null) return task.epicId;
  if (task.parentId === null) return null;
  const parent = tasks.find((entry) => entry.id === task.parentId);
  if (!parent) return task.parentId;
  if (parent.parentId === null) return parent.id;
  return resolveEpicId(tasks, parent);
}

export function incompleteSubtasks(
  tasks: BridgeTask[],
  parentId: number,
): BridgeTask[] {
  return listSubtasks(tasks, parentId).filter((task) => !isWorkDone(task));
}

export function assertCanAdvanceWorkStatus(
  tasks: BridgeTask[],
  task: BridgeTask,
  nextStatus: WorkStatus,
): void {
  if (nextStatus === "todo") return;
  if (!task.parentId) return;
  const parent = tasks.find((entry) => entry.id === task.parentId);
  if (!parent || parent.parentId === null) return;
  if (!isWorkDone(parent)) {
    throw new AppError("Parent task must be done first", 409);
  }
}

export function assertCanCompleteTask(
  tasks: BridgeTask[],
  task: BridgeTask,
): void {
  const blocked = incompleteSubtasks(tasks, task.id);
  if (blocked.length === 0) return;
  throw new AppError(
    `Cannot complete: ${blocked.length} subtask(s) are not done`,
    409,
    {
      subtasks: blocked.map((entry) => ({
        id: entry.id,
        title: entry.title,
        stageId: entry.stageId,
      })),
    },
  );
}

export function canonicalDescription(task: BridgeTask): string {
  return task.description;
}
