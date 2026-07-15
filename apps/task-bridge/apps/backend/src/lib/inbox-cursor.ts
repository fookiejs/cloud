import { Buffer } from "node:buffer";

export type InboxCursorPayload = {
  activityAt: string;
  taskId: number;
};

export function encodeInboxCursor(item: {
  taskId: number;
  activityAt: string | null;
  createdAt: string | null;
}): string {
  let activityAt = "";
  if (item.activityAt !== null) {
    activityAt = item.activityAt;
  } else if (item.createdAt !== null) {
    activityAt = item.createdAt;
  }
  return Buffer.from(`${activityAt}|${item.taskId}`, "utf8").toString("base64url");
}

export function decodeInboxCursor(cursor: string): InboxCursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const lastPipe = decoded.lastIndexOf("|");
    if (lastPipe < 0) return null;
    const activityAt = decoded.slice(0, lastPipe);
    const taskId = Number(decoded.slice(lastPipe + 1));
    if (!Number.isFinite(taskId) || taskId <= 0) return null;
    return { activityAt, taskId };
  } catch {
    return null;
  }
}

export function inboxItemBeforeCursor(
  item: { taskId: number; activityAt: string | null; createdAt: string | null },
  cursorTime: number,
  cursorTaskId: number,
  parseActivityTime: (entry: {
    taskId: number;
    activityAt: string | null;
    createdAt: string | null;
  }) => number,
): boolean {
  const itemTime = parseActivityTime(item);
  if (!Number.isNaN(itemTime) && !Number.isNaN(cursorTime) && itemTime !== cursorTime) {
    return itemTime < cursorTime;
  }
  return item.taskId < cursorTaskId;
}
