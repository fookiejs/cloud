const READ_KEY = "task-bridge.read-tasks";
const NOTIFY_KEY = "task-bridge.notified-comments";

function toStoredTaskId(value: string | number | boolean | null): number | null {
  if (Number.isInteger(value)) {
    return value as number;
  }
  if (value === null) {
    return null;
  }
  const text = String(value).trim();
  if (text.length === 0) {
    return null;
  }
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

function readIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (string | number | boolean | null)[];
    if (!Array.isArray(parsed)) return [];
    const ids: number[] = [];
    for (const entry of parsed) {
      const id = toStoredTaskId(entry);
      if (id !== null) {
        ids.push(id);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: number[]) {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
}

export function isTaskRead(taskId: number) {
  return readIds(READ_KEY).includes(taskId);
}

export function markTaskRead(taskId: number) {
  if (!Number.isInteger(taskId)) {
    return;
  }
  writeIds(READ_KEY, readIds(READ_KEY).concat([taskId]));
  window.dispatchEvent(new CustomEvent("task-bridge:read"));
}

export function wasCommentNotified(taskId: number) {
  return readIds(NOTIFY_KEY).includes(taskId);
}

export function markCommentNotified(taskId: number) {
  if (!Number.isInteger(taskId)) {
    return;
  }
  writeIds(NOTIFY_KEY, readIds(NOTIFY_KEY).concat([taskId]));
}

export function unreadCommentCount(items: { taskId: number; commentCount: number }[]) {
  return items.filter((item) => item.commentCount > 0 && !isTaskRead(item.taskId)).length;
}
