import {
  allocateTaskRowId,
  listTaskRows,
  mutateTaskRow,
  upsertTaskRow,
} from "../db/tasks-db.js";
import {
  isDoneStage,
  resolveEpicId,
  touchTask,
  type AssigneeKind,
  type AgentMetadata,
  type BridgeTask,
} from "../domain/task.js";
import { isWorkDone, type WorkStatus } from "../domain/work-status.js";
import { emptyToNull } from "../lib/strings.js";
import { resolveTaskAssignee } from "./task-assignee-service.js";
import { syncTaskIntoWorkflowState } from "./workflow-state-service.js";

export {
  assertCanCompleteTask,
  canonicalDescription,
  DONE_STAGE_ID,
  isDoneStage,
  isTaskClaimed,
  listSubtasks,
  sortTasks,
  type BridgeTask,
  type TaskComment,
  type TaskEvent,
} from "../domain/task.js";

export function allocateTaskId(): number {
  return allocateTaskRowId();
}

export function listBridgeTasks(): BridgeTask[] {
  return listTaskRows({ id: 0 });
}

export function getBridgeTask(id: number): BridgeTask | null {
  const rows = listTaskRows({ id });
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row) return null;
  return row;
}

export function upsertBridgeTask(input: {
  id: number;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  createdBy: string | null;
  createdAt: string | null;
  stageId: string | null;
  assignee: string | null;
  assigneeRole: string | null;
  assigneeKind: AssigneeKind | null;
  parentId: number | null;
  epicId: number | null;
  templateId: string | null;
  workStatus: WorkStatus | null;
}): BridgeTask {
  const existingRows = listTaskRows({ id: input.id });
  if (existingRows.length > 0) {
    const existing = existingRows[0];
    if (!existing) throw new Error("Unexpected missing row");
    existing.title = input.title;
    existing.description = input.description;
    existing.projectId = input.projectId;
    existing.projectName = input.projectName;
    touchTask(existing);
    upsertTaskRow(existing);
    return existing;
  }

  let createdAt = new Date().toISOString();
  if (input.createdAt !== null) {
    createdAt = input.createdAt;
  }

  let createdBy = "mobile";
  if (input.createdBy !== null) {
    createdBy = input.createdBy;
  }

  const existingTasks = listTaskRows({ id: 0 });

  let parentRow: BridgeTask | null = null;
  if (input.parentId !== null) {
    const parentRows = listTaskRows({ id: input.parentId });
    if (parentRows.length > 0 && parentRows[0]) {
      parentRow = parentRows[0];
    }
  }

  let resolvedEpicId: number | null = null;
  if (input.epicId !== null) {
    resolvedEpicId = input.epicId;
  } else if (parentRow !== null) {
    resolvedEpicId = resolveEpicId(existingTasks, parentRow);
  }

  let workStatus: WorkStatus | null = null;
  if (input.workStatus !== null) {
    workStatus = input.workStatus;
  } else if (input.parentId !== null) {
    workStatus = "todo";
  }

  const resolvedAssignee = resolveTaskAssignee({
    projectId: input.projectId,
    assignee: input.assignee,
    assigneeRole: input.assigneeRole,
    stageId: input.stageId,
  });

  const task: BridgeTask = {
    id: input.id,
    projectId: input.projectId,
    projectName: input.projectName,
    parentId: input.parentId,
    epicId: resolvedEpicId,
    templateId: input.templateId,
    title: input.title,
    description: input.description,
    acceptanceCriteria: null,
    priority: null,
    labels: [],
    createdBy,
    createdAt,
    updatedAt: createdAt,
    claimedBy: null,
    claimedAt: null,
    answeredBy: null,
    answeredAt: null,
    answer: null,
    stageId: input.stageId,
    workStatus,
    brief: "",
    agentMetadata: {},
    assignee: resolvedAssignee.assignee,
    assigneeRole: resolvedAssignee.assigneeRole,
    assigneeKind: input.assigneeKind,
    comments: [],
    events: [{ type: "created", at: createdAt, by: createdBy, note: null }],
  };
  upsertTaskRow(task);
  return task;
}

export function transitionBridgeTask(
  id: number,
  input: {
    stageId: string;
    assignee: string | null;
    by: string;
  },
): BridgeTask | null {
  const existing = getBridgeTask(id);
  if (!existing) return null;
  const resolved = resolveTaskAssignee({
    projectId: existing.projectId,
    assignee: input.assignee,
    assigneeRole: existing.assigneeRole,
    stageId: input.stageId,
  });
  return mutateTaskRow(id, (task) => {
    const at = new Date().toISOString();
    const fromStage = task.stageId;
    task.stageId = input.stageId;
    task.assignee = resolved.assignee;
    if (resolved.assigneeRole) {
      task.assigneeRole = resolved.assigneeRole;
    }
    if (isDoneStage(input.stageId)) {
      task.claimedBy = null;
      task.claimedAt = null;
    }
    task.events.push({
      type: "stage_changed",
      at,
      by: input.by,
      note: `${fromStage || "none"} -> ${input.stageId}`,
    });
    touchTask(task);
  });
}

export function claimBridgeTask(
  id: number,
  claimedBy: string,
): BridgeTask | null {
  const existingRows = listTaskRows({ id });
  if (existingRows.length === 0) return null;
  const existing = existingRows[0];
  if (!existing) return null;
  if (existing.claimedBy) return null;
  if (existing.parentId === null) return null;
  if (isWorkDone(existing)) return null;

  return mutateTaskRow(id, (task) => {
    const claimedAt = new Date().toISOString();
    task.claimedBy = claimedBy;
    task.claimedAt = claimedAt;
    task.events.push({ type: "claimed", at: claimedAt, by: claimedBy, note: null });
    touchTask(task);
  });
}

export function releaseBridgeTask(id: number): BridgeTask | null {
  return mutateTaskRow(id, (task) => {
    task.claimedBy = null;
    task.claimedAt = null;
    touchTask(task);
  });
}

export function updateBridgeTaskSpec(
  id: number,
  input: {
    description: string | null;
    title: string | null;
    by: string;
  },
): BridgeTask | null {
  return mutateTaskRow(id, (task) => {
    if (input.title !== null) task.title = input.title;
    if (input.description !== null) {
      task.description = input.description;
    }
    const at = new Date().toISOString();
    task.events.push({ type: "spec_updated", at, by: input.by, note: null });
    touchTask(task);
  });
}

export function addBridgeTaskComment(
  id: number,
  input: {
    by: string;
    text: string;
    role: "user" | "system";
    tags: string[];
    releaseClaim: boolean;
  },
): BridgeTask | null {
  const body = emptyToNull(input.text);
  if (!body) return null;

  const updated = mutateTaskRow(id, (task) => {
    const at = new Date().toISOString();
    task.comments.push({
      id: `${input.role}-${id}-${Date.now()}`,
      role: input.role,
      authorId: input.by,
      tags: input.tags,
      body,
      at,
      metadata: null,
    });
    if (input.releaseClaim) {
      task.claimedBy = null;
      task.claimedAt = null;
    }
    task.events.push({ type: "commented", at, by: input.by, note: body.slice(0, 200) });
    touchTask(task);
  });
  if (updated) syncTaskIntoWorkflowState(updated);
  return updated;
}

export function addBridgeTaskUserComment(
  id: number,
  by: string,
  text: string,
): BridgeTask | null {
  return addBridgeTaskComment(id, {
    by,
    text,
    role: "user",
    tags: [],
    releaseClaim: true,
  });
}

export function addBridgeTaskAgentComment(
  id: number,
  by: string,
  text: string,
  tags: string[] = [],
): BridgeTask | null {
  return addBridgeTaskComment(id, {
    by,
    text,
    role: "system",
    tags,
    releaseClaim: false,
  });
}

export function clearBridgeTaskComments(
  id: number,
  by: string,
): BridgeTask | null {
  return mutateTaskRow(id, (task) => {
    task.comments = [];
    const at = new Date().toISOString();
    task.events.push({ type: "spec_updated", at, by, note: "comments_cleared" });
    touchTask(task);
  });
}

export function updateBridgeTaskBrief(
  id: number,
  input: {
    brief: string | null;
    append: string | null;
    by: string;
  },
): BridgeTask | null {
  return mutateTaskRow(id, (task) => {
    if (input.brief !== null) {
      task.brief = input.brief;
    } else if (input.append !== null && input.append.trim().length > 0) {
      const chunk = input.append.trim();
      if (task.brief.length > 0) {
        task.brief = `${task.brief}\n\n${chunk}`;
      } else {
        task.brief = chunk;
      }
    }
    const at = new Date().toISOString();
    task.events.push({ type: "spec_updated", at, by: input.by, note: "brief" });
    touchTask(task);
  });
}

export function updateBridgeTaskAgentMetadata(
  id: number,
  patch: Partial<AgentMetadata>,
): BridgeTask | null {
  return mutateTaskRow(id, (task) => {
    task.agentMetadata = Object.assign({}, task.agentMetadata, patch);
    touchTask(task);
  });
}
