import { taskHasLiveRunning } from '@/lib/task-running';
import type { Execution, ExecutionStatus, Task } from '@/types';

export interface WorkspaceTaskDot {
  taskId: string;
  taskName: string;
  status: ExecutionStatus | 'idle';
}

const STATUS_RANK: Record<ExecutionStatus | 'idle', number> = {
  running: 0,
  failed: 1,
  cancelled: 2,
  pending: 3,
  success: 4,
  idle: 5,
};

function taskDisplayStatus(
  taskId: string,
  history: readonly Execution[],
  liveExec: Record<string, { taskId: string; status: ExecutionStatus }>,
): ExecutionStatus | 'idle' {
  if (taskHasLiveRunning(taskId, liveExec, history)) {
    return 'running';
  }
  const last = history[0];
  if (last === undefined) {
    return 'idle';
  }
  return last.status;
}

export function workspaceTaskStatusDots(
  workspaceId: string,
  tasksByWorkspace: Record<string, Task[]>,
  executionsByTask: Record<string, Execution[]>,
  liveExec: Record<string, { taskId: string; status: ExecutionStatus }>,
  max = 8,
): WorkspaceTaskDot[] {
  const tasks = tasksByWorkspace[workspaceId];
  if (tasks === undefined || tasks.length === 0) {
    return [];
  }
  const rows: WorkspaceTaskDot[] = [];
  for (const t of tasks) {
    const history = executionsByTask[t.id];
    let hist: Execution[] = [];
    if (history !== undefined) {
      hist = history;
    }
    rows.push({
      taskId: t.id,
      taskName: t.name,
      status: taskDisplayStatus(t.id, hist, liveExec),
    });
  }
  rows.sort((a, b) => {
    const ra = STATUS_RANK[a.status];
    const rb = STATUS_RANK[b.status];
    if (ra !== rb) {
      return ra - rb;
    }
    return a.taskName.localeCompare(b.taskName);
  });
  return rows.slice(0, max);
}
