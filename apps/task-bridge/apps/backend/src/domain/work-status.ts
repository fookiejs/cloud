import { isDoneStage, type BridgeTask } from "./task.js";

export const WORK_STATUSES = ["todo", "in_progress", "done"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export function isWorkStatus(value: string | null): value is WorkStatus {
  if (value === null) {
    return false;
  }
  return WORK_STATUSES.includes(value as WorkStatus);
}

export function resolveWorkStatus(task: BridgeTask): WorkStatus {
  if (task.workStatus && isWorkStatus(task.workStatus)) {
    return task.workStatus;
  }
  if (task.parentId === null) {
    return "todo";
  }
  if (isDoneStage(task.stageId)) {
    return "done";
  }
  return "todo";
}

export function isWorkDone(task: BridgeTask): boolean {
  return resolveWorkStatus(task) === "done";
}

export function workStatusLabel(status: WorkStatus): string {
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  return "Todo";
}
