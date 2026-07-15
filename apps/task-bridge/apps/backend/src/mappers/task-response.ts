import {
  canonicalDescription,
  isDoneStage,
  isTaskClaimed,
  listEpicWorkflowTasks,
  listSubtasks,
  resolveTaskStageId,
  type BridgeTask,
  type TaskComment,
} from "../domain/task.js";
import { isWorkDone, resolveWorkStatus, workStatusLabel } from "../domain/work-status.js";
import { syncEpicStage } from "../services/epic-service.js";
import { listTaskLibraryLinks } from "../services/library-service.js";
import { getStageSnapshot, getStageTitleLookup } from "../services/workflow-service.js";
import { AppError } from "../errors/app-error.js";
import {
  decodeInboxCursor,
  encodeInboxCursor,
  inboxItemBeforeCursor,
} from "../lib/inbox-cursor.js";
import { listBridgeTasks } from "../services/task-service.js";
import { listWorkflowStateSummaries } from "../services/workflow-state-service.js";
import { getProjectById } from "../services/project-registry.js";

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

export function consumerStatus(task: BridgeTask | null): "sent" | "ready" {
  if (!task) return "sent";

  if (isTaskClaimed(task)) return "sent";
  if (isWorkDone(task)) return "ready";

  const lastUser = latestCommentByRole(task.comments, "user");
  const lastSystem = latestCommentByRole(task.comments, "system");
  if (lastUser !== null && lastSystem !== null) {
    const userAt = Date.parse(lastUser.at);
    const systemAt = Date.parse(lastSystem.at);
    if (!Number.isNaN(userAt) && !Number.isNaN(systemAt) && userAt > systemAt) {
      return "sent";
    }
  }
  if (lastSystem !== null) return "ready";
  if (lastUser !== null && lastUser.authorId !== task.createdBy) return "ready";
  return "sent";
}

export function mapComments(task: BridgeTask) {
  return task.comments.map((comment) => ({
    id: comment.id,
    role: comment.role,
    authorId: comment.authorId,
    tags: comment.tags,
    body: comment.body,
    at: comment.at,
    metadata: comment.metadata,
    by: comment.authorId,
    text: comment.body,
  }));
}

function previewForTask(task: BridgeTask): string | null {
  const lastComment = task.comments[task.comments.length - 1];
  if (!lastComment) return null;
  const text = lastComment.body;
  if (!text) return null;
  if (text.length > 160) return `${text.slice(0, 157)}...`;
  return text;
}

function resolveStageTitle(
  stageId: string | null,
  projectId: string,
  stageTitles: Map<string, string>,
): string | null {
  if (stageId === null) return null;
  const fromMap = stageTitles.get(`${projectId}:${stageId}`);
  if (fromMap) return fromMap;
  return stageId;
}

function mapSubtaskSummary(
  task: BridgeTask,
  stageTitles: Map<string, string>,
  allTasks: BridgeTask[],
) {
  const resolvedStage = resolveTaskStageId(allTasks, task);
  let stageId = task.stageId;
  if (resolvedStage !== null) {
    stageId = resolvedStage;
  }
  const stageTitle = resolveStageTitle(stageId, task.projectId, stageTitles);
  const workStatus = resolveWorkStatus(task);
  return {
    taskId: task.id,
    parentId: task.parentId,
    title: task.title,
    stageId,
    stageTitle,
    templateId: task.templateId,
    assignee: task.assignee,
    claimedBy: task.claimedBy,
    workStatus,
    workStatusLabel: workStatusLabel(workStatus),
    done: workStatus === "done",
  };
}

export function mapTaskDetail(task: BridgeTask) {
  if (task.parentId === null) {
    syncEpicStage(task.id);
    const refreshed = listBridgeTasks().find((entry) => entry.id === task.id);
    if (refreshed) task = refreshed;
  }

  const stage = getStageSnapshot(task.projectId, task.stageId);
  const allTasks = listBridgeTasks();
  const stageTitles = getStageTitleLookup(task.projectId);
  let workflowSubtasks: BridgeTask[];
  if (task.parentId === null) {
    workflowSubtasks = listEpicWorkflowTasks(allTasks, task.id);
  } else {
    workflowSubtasks = listSubtasks(allTasks, task.id);
  }
  const subtasks = workflowSubtasks.map((entry) => mapSubtaskSummary(entry, stageTitles, allTasks));
  let parent: BridgeTask | null = null;
  if (task.parentId !== null) {
    const found = allTasks.find((entry) => entry.id === task.parentId);
    if (found) parent = found;
  }

  let parentPayload: { taskId: number; title: string; stageId: string | null } | null = null;
  if (parent !== null) {
    parentPayload = { taskId: parent.id, title: parent.title, stageId: parent.stageId };
  }

  let workStatusPayload: string | null = null;
  if (task.parentId !== null) {
    workStatusPayload = resolveWorkStatus(task);
  }

  let workStatusLabelPayload: string | null = null;
  if (task.parentId !== null) {
    workStatusLabelPayload = workStatusLabel(resolveWorkStatus(task));
  }

  let workflowState = null;
  if (task.parentId === null) {
    workflowState = listWorkflowStateSummaries(task.id).map((node) =>
      Object.assign({}, node, { workStatusLabel: workStatusLabel(node.workStatus) }),
    );
  }

  return {
    taskId: task.id,
    title: task.title,
    request: canonicalDescription(task),
    description: canonicalDescription(task),
    priority: task.priority,
    labels: task.labels,
    assignee: task.assignee,
    parentId: task.parentId,
    parent: parentPayload,
    subtasks,
    stageId: task.stageId,
    stage,
    workStatus: workStatusPayload,
    workStatusLabel: workStatusLabelPayload,
    isEpic: task.parentId === null,
    status: consumerStatus(task),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    createdBy: task.createdBy,
    projectId: task.projectId,
    projectName: task.projectName,
    claimedBy: task.claimedBy,
    events: task.events,
    comments: mapComments(task),
    libraryLinks: listTaskLibraryLinks(task.id),
    brief: task.brief,
    agentMetadata: task.agentMetadata,
    workflowState,
  };
}

function parseActivityTime(item: {
  activityAt: string | null;
  createdAt: string | null;
}): number {
  let raw: string | null = null;
  if (item.activityAt !== null) {
    raw = item.activityAt;
  } else if (item.createdAt !== null) {
    raw = item.createdAt;
  }
  if (!raw) return NaN;
  return Date.parse(raw);
}

function sortInboxByActivity<
  T extends { taskId: number; activityAt: string | null; createdAt: string | null },
>(items: T[]): T[] {
  return items.slice().sort((a, b) => {
    const aTime = parseActivityTime(a);
    const bTime = parseActivityTime(b);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    return b.taskId - a.taskId;
  });
}

export function buildInboxItems(query: {
  projectId: string | null;
  commentsOnly: boolean | null;
  epicsOnly: boolean | null;
  cursor: string | null;
  limit: number;
  ownerUserId?: string | null;
}) {
  let bridgeTasks = listBridgeTasks();
  if (query.ownerUserId) {
    bridgeTasks = bridgeTasks.filter(
      (task) => getProjectById(task.projectId, query.ownerUserId as string) !== null,
    );
  }
  const stageTitles = new Map<string, string>();
  for (const task of bridgeTasks) {
    if (stageTitles.has(task.projectId)) continue;
    const lookup = getStageTitleLookup(task.projectId);
    for (const [stageId, title] of lookup.entries()) {
      stageTitles.set(`${task.projectId}:${stageId}`, title);
    }
    stageTitles.set(task.projectId, "loaded");
  }

  let items = bridgeTasks.map((task) => {
    let activityAt: string = task.createdAt;
    const lastComment = task.comments[task.comments.length - 1];
    if (lastComment) {
      activityAt = lastComment.at;
    } else if (task.updatedAt) {
      activityAt = task.updatedAt;
    } else if (task.claimedAt !== null) {
      activityAt = task.claimedAt;
    }
    const stageTitle = resolveStageTitle(task.stageId, task.projectId, stageTitles);
    return {
      taskId: task.id,
      title: task.title,
      preview: previewForTask(task),
      status: consumerStatus(task),
      activityAt,
      updatedAt: activityAt,
      createdAt: task.createdAt,
      done: isDoneStage(task.stageId),
      parentId: task.parentId,
      projectId: task.projectId,
      projectName: task.projectName,
      createdBy: task.createdBy,
      claimedBy: task.claimedBy,
      assignee: task.assignee,
      stageId: task.stageId,
      stageTitle,
      commentCount: task.comments.length,
    };
  });

  if (query.projectId !== null) {
    items = items.filter((item) => item.projectId === query.projectId);
  }
  if (query.commentsOnly) {
    items = items.filter((item) => item.commentCount > 0);
  }
  if (query.epicsOnly) {
    items = items.filter((item) => item.parentId === null);
  }

  items = sortInboxByActivity(items);

  if (query.cursor !== null) {
    const decoded = decodeInboxCursor(query.cursor);
    if (!decoded) throw new AppError("Invalid cursor", 400);
    const cursorTime = Date.parse(decoded.activityAt);
    items = items.filter((item) =>
      inboxItemBeforeCursor(item, cursorTime, decoded.taskId, parseActivityTime),
    );
  }

  const slice = items.slice(0, query.limit + 1);
  const hasMore = slice.length > query.limit;
  let pageItems = slice;
  if (hasMore) {
    pageItems = slice.slice(0, query.limit);
  }
  const lastItem = pageItems[pageItems.length - 1];

  let nextCursor: string | null = null;
  if (hasMore && lastItem) {
    nextCursor = encodeInboxCursor(lastItem);
  }

  return {
    items: pageItems,
    limit: query.limit,
    nextCursor,
    hasMore,
  };
}
